import { requireSession } from '@/server/auth/require-session';

export default async function Dashboard() {
  const { user } = await requireSession();
  return (
    <>
      <h1>Inicio</h1>
      <p className="lead">Has entrado como {user.email}.</p>
      <section className="panel">
        <p>El contenido del family office se añadirá aquí.</p>
      </section>
    </>
  );
}
