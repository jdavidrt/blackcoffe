import { useEffect } from "react";
import dayjs from "dayjs";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../context/ProductProvider";
import { useState } from "react";
import { PlusCircleOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";

function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { products, loadProducts } = useProducts();
  useEffect(() => {
    loadProducts()
  }, []);

  const filteredProducts = products.filter((product) =>
    product.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function renderMain() {
    if (products.length === 0) return <h1>No hay productos</h1>;
    return filteredProducts.map((product) => <ProductCard product={product} key={product.id} />);
  }

  return (
    <div>
      <div className="py-2"><h4 className="text-2xl text-black text-center font-bold text-center">Productos ({products.length}) </h4>
        <div className="flex">
          <div className="px-2" />
          <div className="ml-auto">
            <Link to="/nuevoProducto">
              <div><button type="button"
                className=" bg-emerald-400 px-3 py-1 text-black rounded-md ml-auto" backgroundColor='#F3F1F1'>Nuevo Producto</button></div>
            </Link>
          </div>

        </div>
        <SearchBar onSearch={setSearchTerm} />
      </div>
      <div className="bg-yellow-500  rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default ProductsPage;
