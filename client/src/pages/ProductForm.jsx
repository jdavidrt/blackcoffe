import { Form, Formik } from "formik";
import { useProducts } from "../context/ProductProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function ProductForm() {
  const { createProduct, getProduct, updateProduct } = useProducts();
  const [product, setProduct] = useState({
    productName: "",
    unitValue: ""
  });
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const loadProduct = async () => {
      if (params.id) {
        const product = await getProduct(params.id);
        console.log(product);
        setProduct({
          productName: product.productName,
          unitValue: product.unitValue
        });
      }
    };
    loadProduct();
  }, []);

  return (
    <div>
      <Formik
        initialValues={product}
        enableReinitialize={true}
        onSubmit={async (values, actions) => {
          console.log(values);
          if (params.id) {
            await updateProduct(params.id, values);
          } else {
            await createProduct(values);
          }
          navigate("/productos");
          setProduct({
            productName: "",
            unitValue: ""
          });
        }}
      >
        {({ handleChange, handleSubmit, values, isSubmitting }) => (
          <Form
            onSubmit={handleSubmit}
            className="bg-stone-300 max-w-sm rounded-md p-4 mx-auto mt-8"
          >
            <h1 className="text-xl font-bold uppercase text-center">
              {params.id ? "Editar Producto" : "Nuevo Producto"}
            </h1>
            <label className="block text-center py-2">Nombre de producto: </label>
            <input
              type="text"
              name="productName"
              placeholder="Ej: Chocorramo"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.productName}
              style={{ textTransform: 'uppercase' }}
            />
            <label className="block text-center py-2">Valor unitario del producto: </label>
            <input
              type="number"
              name="unitValue"
              placeholder="Ingresar valor sin puntos ni comas"
              min="100"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.unitValue}
            />
            <div className="py-2"></div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="block bg-green-500 px-2 py-2 text-white w-full rounded-md"
            >
              <b className="gray-400">{isSubmitting ? "Guardando producto..." : params.id ? "MODIFICAR" : 'CREAR'}</b>
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
}

export default ProductForm;
