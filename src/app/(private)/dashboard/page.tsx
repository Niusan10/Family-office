import Link from 'next/link';

const modules = [
  { href: '/patrimonio', title: 'Patrimonio', text: 'Visión consolidada de activos y pasivos.' },
  { href: '/sociedades', title: 'Sociedades', text: 'Estructura societaria, participaciones y órganos.' },
  { href: '/tesoreria', title: 'Tesorería', text: 'Cuentas, saldos y previsión de caja.' },
  { href: '/inversiones', title: 'Inversiones', text: 'Cartera, operaciones y rentabilidad.' },
];

export default function Dashboard() {
  return (
    <>
      <h1>Inicio</h1>
      <p className="lead">Selecciona un área.</p>
      <div className="grid">
        {modules.map((m) => (
          <Link key={m.href} href={m.href} className="card">
            <h2>{m.title}</h2>
            <p>{m.text}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
