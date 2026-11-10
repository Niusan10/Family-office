'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type Progress = { label: string; value: number | null };

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

/**
 * Llama a /api/escrituras/process hasta que la escritura queda lista (o falla). Cada llamada hace un paso;
 * si Claude está saturado, espera lo que diga el servidor y reintenta.
 */
async function runProcessing(id: string, csrf: string, onProgress: (p: Progress) => void): Promise<string | null> {
  let failures = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(`/api/escrituras/process?id=${encodeURIComponent(id)}`, { method: 'POST', headers: { 'x-csrf-token': csrf } });
    } catch {
      if (++failures > 8) return 'Se ha perdido la conexión. Puedes reanudar el procesado desde la lista.';
      await sleep(10);
      continue;
    }
    const data = (await res.json().catch(() => ({}))) as {
      status?: string; done?: number; total?: number | null; pages?: number | null; error?: string | null; retryAfter?: number;
    };
    if (res.status === 503 || res.status === 504) {
      if (++failures > 12) return 'Claude sigue saturado. Puedes reanudar el procesado más tarde desde la lista.';
      onProgress({ label: 'Claude está ocupado, esperando para seguir…', value: null });
      await sleep(data.retryAfter ?? 20);
      continue;
    }
    if (!res.ok) return data.error ?? 'No se ha podido procesar.';
    failures = 0;
    if (data.status === 'error') return data.error ?? 'No se ha podido procesar.';
    if (data.status === 'ready') return null;
    const total = data.total ?? 0;
    const done = data.done ?? 0;
    onProgress(
      total === 0
        ? { label: 'Preparando el PDF…', value: null }
        : done < total
          ? { label: `Leyendo páginas: ${Math.min(done * 4, data.pages ?? 0)} de ${data.pages ?? '…'}`, value: done / total }
          : { label: 'Preparando la ficha…', value: 1 },
    );
  }
}

export function UploadEscritura({ csrf, companies }: { csrf: string; companies: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) return setMsg({ kind: 'err', text: 'Elige un PDF.' });
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return setMsg({ kind: 'err', text: 'Solo se admiten PDF.' });

    setBusy(true);
    setMsg(null);
    try {
      setProgress({ label: 'Subiendo…', value: 0 });
      const start = await fetch('/api/escrituras/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ title: fd.get('title'), company: fd.get('company'), fileName: file.name, size: file.size }),
      });
      const s = (await start.json().catch(() => ({}))) as { id?: string; parts?: number; partBytes?: number; error?: string };
      if (!start.ok || !s.id || !s.parts || !s.partBytes) throw new Error(s.error ?? 'No se ha podido empezar la subida.');

      for (let n = 0; n < s.parts; n++) {
        const slice = file.slice(n * s.partBytes, (n + 1) * s.partBytes);
        let ok = false;
        for (let attempt = 0; attempt < 3 && !ok; attempt++) {
          const r = await fetch(`/api/escrituras/part?id=${s.id}&n=${n}`, {
            method: 'POST',
            headers: { 'content-type': 'application/octet-stream', 'x-csrf-token': csrf },
            body: slice,
          }).catch(() => null);
          if (r?.ok) ok = true;
          else if (r && r.status === 400) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Subida no válida.');
          else await sleep(3);
        }
        if (!ok) throw new Error('Se ha cortado la subida. Vuelve a intentarlo.');
        setProgress({ label: `Subiendo… ${Math.round(((n + 1) / s.parts) * 100)} %`, value: (n + 1) / s.parts });
      }

      router.refresh();
      setProgress({ label: 'Preparando el PDF…', value: null });
      const err = await runProcessing(s.id, csrf, setProgress);
      if (err) throw new Error(err);
      form.reset();
      setMsg({ kind: 'ok', text: 'Escritura subida y leída. Ya se puede preguntar sobre ella.' });
    } catch (e2) {
      setMsg({ kind: 'err', text: e2 instanceof Error ? e2.message : 'No se ha podido subir.' });
    } finally {
      setBusy(false);
      setProgress(null);
      router.refresh();
    }
  }

  return (
    <section className="panel esc-upload" aria-labelledby="h-upload">
      <h2 id="h-upload">Subir escritura</h2>
      <form onSubmit={onSubmit} className="esc-upload-form">
        <label>
          <span>PDF</span>
          <input type="file" name="file" accept="application/pdf,.pdf" required disabled={busy} />
        </label>
        <label>
          <span>Empresa</span>
          <select name="company" required disabled={busy} defaultValue="">
            <option value="" disabled>
              Elige…
            </option>
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Nombre (opcional)</span>
          <input name="title" maxLength={140} placeholder="p. ej. Constitución 2015" disabled={busy} />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Procesando…' : 'Subir y leer'}
        </button>
      </form>
      {progress && (
        <div className="esc-progress" role="status">
          {progress.value === null ? <progress /> : <progress value={progress.value} max={1} />}
          <span>{progress.label}</span>
        </div>
      )}
      {busy && <p className="esc-note">No cierres esta pestaña hasta que termine. Una escritura de 50 páginas tarda unos minutos.</p>}
      {msg && <p className={`esc-msgline ${msg.kind}`}>{msg.text}</p>}
    </section>
  );
}

/** Botones de cada escritura en la lista (solo administradores). */
export function EscrituraActions({ id, title, csrf, processing }: { id: string; title: string; csrf: string; processing: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function resume() {
    setBusy('Reanudando…');
    const err = await runProcessing(id, csrf, (p) => setBusy(p.label));
    setBusy(null);
    if (err) window.alert(err);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`¿Borrar «${title}»? Se elimina el PDF y su transcripción.`)) return;
    setBusy('Borrando…');
    const r = await fetch(`/api/escrituras/delete?id=${encodeURIComponent(id)}`, { method: 'POST', headers: { 'x-csrf-token': csrf } }).catch(() => null);
    setBusy(null);
    if (!r?.ok) window.alert('No se ha podido borrar.');
    router.refresh();
  }

  if (busy) return <span className="esc-busy">{busy}</span>;
  return (
    <span className="esc-actions">
      {processing && (
        <button type="button" onClick={() => void resume()}>
          Reanudar
        </button>
      )}
      <button type="button" className="danger" onClick={() => void remove()}>
        Borrar
      </button>
    </span>
  );
}
