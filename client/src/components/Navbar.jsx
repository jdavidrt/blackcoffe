import { useState } from 'react';
import { Link } from 'react-router-dom';

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const logOut = () => {
    // Abre una ventana de confirmación
    const confirmacion = window.confirm("¿Estás seguro de cerrar sesión?");

    // Verifica la respuesta del usuario
    if (confirmacion) {
      // El usuario seleccionó "Aceptar"
      // Aquí puedes agregar la lógica para cerrar sesión
      localStorage.setItem('user', '');
      console.log("Sesión cerrada");
    } else {
      // El usuario seleccionó "Cancelar" o cerró la ventana de confirmación
      console.log("Cierre de sesión cancelado");
    }
  };

  return (
    <div className="bg-stone-700 px-4 py-2 lg:px-20" style={{
      visibility: (window.location.pathname.includes("/iniciarSesion") || window.location.pathname.includes("/pdfOrden")) == true ? 'hidden' : 'visible',
    }}>
      <div className="flex justify-between items-center">

        {/* Botón del menú hamburguesa visible solo en pantallas pequeñas */}
        <button
          onClick={toggleMenu}
          className="lg:hidden text-white focus:outline-none"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </button>
      </div>

      {/* Menú de navegación */}
      <ul className={`flex flex-col lg:flex flex-col lg:flex-row lg:gap-x-1 ${menuOpen ? 'block' : 'hidden'}`}>
        <li className="mb-1 flex items-center">
          <Link to="/" className="text-white hover:text-black bg-gray-600 rounded px-3 py-2">Cuentas por cobrar</Link>
        </li>
        <li className="mb-1 flex items-center">
          <Link to="/nuevaOrden" className="text-white hover:text-black bg-gray-600 rounded px-3 py-2">Nueva Orden</Link>
        </li>
        <li className="mb-1 flex items-center">
          <Link to="/cobrarOrdenes" className="text-white hover:text-black bg-gray-600 rounded px-3 py-2">Cobrar</Link>
        </li>
        <li className="mb-1 flex items-center">
          <Link to="/ordenesPagas" className="text-white hover:text-black bg-gray-600 rounded px-3 py-2">Cuentas al día</Link>
        </li>
        <li className="mb-1 flex items-center">
          <Link to="/productos" className="text-white hover:text-black bg-gray-600 rounded px-3 py-2">Productos</Link>
        </li>
        <li className="mb-1 flex items-center">
          <Link to="/clientes" className="text-white hover:text-black bg-gray-600 rounded px-3 py-2">Clientes</Link>
        </li>
        <li className="mb-1 flex items-center" onClick={logOut}>
          <Link to="/iniciarSesion" className="text-white hover:text-black bg-red-900 rounded px-3 py-2">Salir</Link>
        </li>
      </ul>
    </div>

  );
}

export default Navbar;
