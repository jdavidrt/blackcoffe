import { ProductContextProvider, useProducts } from "../context/ProductProvider";
import { useNavigate } from "react-router-dom";
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';

function productCard({ product }) {
  const { deleteProduct } = useProducts();
  const navigate = useNavigate();

  return (
    <div className="flex bg-stone-100 text-black rounded-md m-2">
      <p className="p-2 flex items-center h-content font-bold">{product.productName} - ${product.unitValue}</p>
      <p className="p-2 text-sm text-gray-300 flex items-center justify-center font-bold h-content">
        {product.dateAdded}
      </p>
      <div className="p-2 ml-auto">
        <button
          className="bg-slate-300 px-2 mx-8 py-1 text-black"
          onClick={() => deleteProduct(product.id)}
        >
          <DeleteOutlined />
        </button>
        <button
          className="bg-slate-300 px-2 py-1 text-black"
          onClick={() => navigate(`/editarProducto/${product.id}`)}
        >
          <EditOutlined />
        </button>
      </div>
    </div>
  );
}

export default productCard;
