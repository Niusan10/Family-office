/**
 * Gráfica de quesito (donut) renderizada en el servidor como SVG puro: sin JavaScript y sin estilos
 * en línea (la CSP los bloquea). Al pasar el ratón por un sector se resalta y el navegador muestra
 * su nombre, importe y peso. La leyenda de al lado hace también de tabla con los datos exactos.
 */
export type DonutSlice = { key: string; label: string; value: number; color: string };

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Importe abreviado para el centro del quesito: 12,4 M€ · 850 k€. */
export function eurShort(n: number): string {
  const abs = Math.abs(n);
  const f = (x: number, d: number) => x.toLocaleString('es-ES', { maximumFractionDigits: d });
  if (abs >= 1e9) return `${f(n / 1e9, 2)} mil M€`;
  if (abs >= 1e6) return `${f(n / 1e6, abs >= 1e8 ? 0 : 1)} M€`;
  if (abs >= 1e3) return `${f(n / 1e3, 0)} k€`;
  return eur.format(n);
}

const R = 100; // radio exterior
const r = 64; // radio interior
const C = 110; // centro (viewBox 220×220)

function point(radius: number, angle: number) {
  return [C + radius * Math.sin(angle), C - radius * Math.cos(angle)] as const;
}

function arcPath(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = point(R, a0);
  const [x1, y1] = point(R, a1);
  const [x2, y2] = point(r, a1);
  const [x3, y3] = point(r, a0);
  return `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${large} 0 ${x3} ${y3}Z`;
}

export function DonutChart({ title, slices, centerLabel }: { title: string; slices: DonutSlice[]; centerLabel: string }) {
  const positive = slices.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);
  const excluded = slices.filter((s) => s.value <= 0);

  let angle = 0;
  const arcs = positive.map((s) => {
    const share = s.value / total;
    const a0 = angle;
    angle += share * 2 * Math.PI;
    return { ...s, share, d: share >= 0.9999 ? null : arcPath(a0, angle) };
  });

  // En la leyenda, de mayor a menor peso (el color sigue a la empresa, no a la posición).
  const legend = [...arcs].sort((a, b) => b.value - a.value);

  return (
    <figure className="donut">
      <svg viewBox="0 0 220 220" role="img" aria-label={`${title}: total ${eur.format(total)}`}>
        {arcs.map((s) =>
          s.d === null ? (
            <circle key={s.key} cx={C} cy={C} r={(R + r) / 2} fill="none" stroke={s.color} strokeWidth={R - r}>
              <title>{`${s.label}: ${eur.format(s.value)} (100 %)`}</title>
            </circle>
          ) : (
            <path key={s.key} d={s.d} fill={s.color} stroke="#ffffff" strokeWidth={2} strokeLinejoin="round">
              <title>{`${s.label}: ${eur.format(s.value)} (${pct.format(s.share)})`}</title>
            </path>
          ),
        )}
        <text x={C} y={C - 6} textAnchor="middle" className="donut-total">
          {eurShort(total)}
        </text>
        <text x={C} y={C + 16} textAnchor="middle" className="donut-caption">
          {centerLabel}
        </text>
      </svg>

      <table className="donut-legend">
        <caption className="sr-only">{title}</caption>
        <thead className="sr-only">
          <tr>
            <th>Empresa</th>
            <th>Valor</th>
            <th>Peso</th>
          </tr>
        </thead>
        <tbody>
          {legend.map((s) => (
            <tr key={s.key}>
              <th scope="row">
                <svg className="swatch" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <rect width="12" height="12" rx="3" fill={s.color} />
                </svg>
                {s.label}
              </th>
              <td className="num">{eur.format(s.value)}</td>
              <td className="num pct">{pct.format(s.share)}</td>
            </tr>
          ))}
          {excluded.map((s) => (
            <tr key={s.key} className="excluded">
              <th scope="row">
                <svg className="swatch" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" rx="3" fill="none" stroke={s.color} strokeWidth="2" />
                </svg>
                {s.label}
              </th>
              <td className="num">{eur.format(s.value)}</td>
              <td className="num pct" title="Un valor cero o negativo no puede pesar en el quesito">—</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="num">{eur.format(total)}</td>
            <td className="num pct">{total > 0 ? '100 %' : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </figure>
  );
}
