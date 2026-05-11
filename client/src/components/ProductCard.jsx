import { ProductContextProvider, useProducts } from "../context/ProductProvider";
import { useNavigate } from "react-router-dom";
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';

function productCard({ product }) {
  const { deleteProduct } = useProducts();
  const navigate = useNavigate();

  return (
    <div className="flex items-center bg-stone-100 text-black rounded-md m-2">
      <p className="p-2 flex items-center h-content font-bold">{product.productName} - ${product.unitValue}</p>
      <p className="p-2 text-sm text-gray-500 flex items-center justify-center font-bold h-content">
        {product.dateAdded}
      </p>
      <div className="flex gap-2 p-2 ml-auto">
        <button
          type="button"
          className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-300 text-black"
          onClick={() => deleteProduct(product.id)}
        >
          <DeleteOutlined />
        </button>
        <button
          type="button"
          className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-300 text-black"
          onClick={() => navigate(`/editarProducto/${product.id}`)}
        >
          <EditOutlined />
        </button>
      </div>
    </div>
  );
}

export default productCard;
