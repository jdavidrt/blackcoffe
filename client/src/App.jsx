import { Route, Routes } from "react-router-dom";

import OrdersPage from "./pages/OrdersPage";
import OrderForm from "./pages/OrderForm";
import NotFound from "./pages/NotFound";
import { OrderContextProvider } from "./context/OrderProvider";

import Navbar from "./components/Navbar";

function App() {
  return (
    <div className="bg-zinc-900 h-screen">
      <Navbar />
      <div className="container mx-auto py-4 px-20">
        <OrderContextProvider>
          <Routes>
            <Route path="/" element={<OrdersPage />} />
            <Route path="/new" element={<OrderForm />} />
            <Route path="/edit/:id" element={<OrderForm />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </OrderContextProvider>
      </div>
    </div>
  );
}

export default App;
