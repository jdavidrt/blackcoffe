import { Link } from "react-router-dom";

function Navbar() {
  return (
    <div className="bg-stone-700 flex justify-between px-20 py-4">

      <ul className="flex gap-x-1">
        <li>
          <Link to="/" className="bg-slate-200 px-2 py-1">Cuentas por cobrar</Link>
        </li>
        <li>
          <Link to="/nuevaOrden" className="bg-teal-200 px-2 py-1">Nueva Orden</Link>
        </li>
        <li>
          <Link to="/cobrarOrdenes" className="bg-teal-200 px-2 py-1">Cobrar</Link>
        </li>
        <li>
          <Link to="/ordenesPagas" className="bg-teal-200 px-2 py-1">Cuentas al día</Link>
        </li>
        <li>
          <Link to="/productos" className="bg-teal-200 px-2 py-1">Productos</Link>
        </li>
        <li>
          <Link to="/clientes" className="bg-teal-200 px-2 py-1">Clientes</Link>
        </li>

      </ul>
    </div>
  );
}

export default Navbar;
