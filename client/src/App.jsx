import { Route, Routes } from "react-router-dom";

import OrdersPage from "./pages/OrdersPage";
import OrderForm from "./pages/OrderForm";
import ClientForm from "./pages/ClientForm";
import ProductForm from "./pages/ProductForm";
import ClientsPage from "./pages/ClientsPage";
import ProductsPage from "./pages/ProductsPage";
import NotFound from "./pages/NotFound";
import { OrderContextProvider } from "./context/OrderProvider";
import { ClientContextProvider } from "./context/ClientProvider";
import { ProductContextProvider } from "./context/ProductProvider";

import Navbar from "./components/Navbar";

function App() {
  return (
    <div className="bg-slate-200 h-full">
      <Navbar />
      <div className="container mx-auto py-4 px-20">
        <ClientContextProvider>
          <ProductContextProvider>
            <OrderContextProvider>
              <Routes>
                <Route path="/" element={<OrdersPage />} />
                <Route path="/productos" element={<ProductsPage />} />
                <Route path="/clientes" element={<ClientsPage />} />
                <Route path="/editarProducto/:id" element={<ProductForm />} />
                <Route path="/editarCliente/:id" element={<ClientForm />} />
                <Route path="/nuevaOrden" element={<OrderForm />} />
                <Route path="/nuevoCliente" element={<ClientForm />} />
                <Route path="/nuevoProducto" element={<ProductForm />} />
                <Route path="/editarOrden/:id" element={<OrderForm />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </OrderContextProvider>
          </ProductContextProvider>
        </ClientContextProvider>
      </div>
    </div>
  );
}

export default App;
