import { Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Invoice from "./pages/Invoice";
import PublicInvoice from "./pages/PublicInvoice";
import OrdersPage from "./pages/OrdersPage";
import OrderForm from "./pages/OrderForm";
import ClientForm from "./pages/ClientForm";
import ProductForm from "./pages/ProductForm";
import ClientsPage from "./pages/ClientsPage";
import ProductsPage from "./pages/ProductsPage";
import CollectOrdersPage from "./pages/CollectOrdersPage";
import CollectOrderForm from "./pages/CollectOrderForm";
import CollectedOrdersPage from "./pages/CollectedOrdersPage";
import DepositsPage from "./pages/DepositsPage";
import DeliveryOrdersPage from "./pages/DeliveryPage";
import DeliveredOrdersPage from "./pages/DeliveredPage";
import DepositedOrdersPage from "./pages/DepositedOrdersPage";
import OrphanedOrdersPage from "./pages/OrphanedOrdersPage";
import NotFound from "./pages/NotFound";
import { OrderContextProvider } from "./context/OrderProvider";
import { ClientContextProvider } from "./context/ClientProvider";
import { ProductContextProvider } from "./context/ProductProvider";
import { UserContextProvider } from "./context/UserProvider";
import { DepositContextProvider } from "./context/DepositsProvider";
import LoginForm from "./pages/LoginForm";
import Navbar from "./components/Navbar";
import './fonts/ShareTechMono-Regular.ttf';

function App() {
  // Obtener el valor del usuario desde el localStorage
  const navigate = useNavigate();
  useEffect(() => {
    if (!window.location.pathname.includes("/factura")) {
      if (!window.location.pathname.includes("/iniciarSesion") && localStorage.getItem('user') === "") {
        navigate("/iniciarSesion");
      } else if (localStorage.getItem('user') === null || localStorage.getItem('user') === "") {
        navigate("/iniciarSesion");
      }
    }
  }, [window.location.pathname]);
  return (
    <div className="bg-slate-200 h-screen">
      <UserContextProvider>
        <Navbar />
        <div className="w-full mx-auto py-4 px-2 ">
          <ClientContextProvider>
            <ProductContextProvider>
              <OrderContextProvider>
                <DepositContextProvider>
                  <Routes>
                    <Route path="/" element={<OrdersPage />} />
                    <Route path="/iniciarSesion" element={<LoginForm />} />
                    <Route path="/productos" element={<ProductsPage />} />
                    <Route path="/cobrarOrdenes/:mall" element={<CollectOrdersPage />} />
                    <Route path="/ordenesPagas" element={<CollectedOrdersPage />} />
                    <Route path="/clientes" element={<ClientsPage />} />
                    <Route path="/editarProducto/:id" element={<ProductForm />} />
                    <Route path="/editarCliente/:id" element={<ClientForm />} />
                    <Route path="/nuevaOrden" element={<OrderForm />} />
                    <Route path="/nuevoCliente" element={<ClientForm />} />
                    <Route path="/nuevoProducto" element={<ProductForm />} />
                    <Route path="/editarOrden/:id" element={<OrderForm />} />
                    <Route path="/cobrarOrden/:id" element={<CollectOrderForm />} />
                    <Route path="/pdfOrden/:id" element={<Invoice />} />
                    <Route path="/factura/:id" element={<PublicInvoice />} />
                    <Route path="/abonos/" element={<DepositsPage />} />
                    <Route path="/recorrido/" element={<DeliveryOrdersPage />} />
                    <Route path="/entregados/" element={<DeliveredOrdersPage />} />
                    <Route path="/cobrosHoy/" element={<DepositedOrdersPage />} />
                    <Route path="/ordenesSinCliente/" element={<OrphanedOrdersPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </DepositContextProvider>
              </OrderContextProvider>
            </ProductContextProvider>
          </ClientContextProvider>
        </div>
      </UserContextProvider>
    </div>
  );
}

export default App;
