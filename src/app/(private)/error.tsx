'use client';

// Neutro: nunca muestra el mensaje ni la traza del error.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <h1>Se ha producido un error</h1>
      <p className="lead">Inténtalo de nuevo.</p>
      <button type="button" className="logout" onClick={() => reset()}>
        Reintentar
      </button>
    </>
  );
}
