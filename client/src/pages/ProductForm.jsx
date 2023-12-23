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
          productName: product.productId,
          unitValue: product.shopId
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
          navigate("/");
          setProduct({
            productName: "",
            unitValue: ""
          });
        }}
      >
        {({ handleChange, handleSubmit, values, isSubmitting }) => (
          <Form
            onSubmit={handleSubmit}
            className="bg-slate-300 max-w-sm rounded-md p-4 mx-auto mt-10"
          >
            <h1 className="text-xl font-bold uppercase text-center">
              {params.id ? "Edit Product" : "New Product"}
            </h1>
            <label className="block">productName</label>
            <input
              type="text"
              name="productName"
              placeholder="Id producte"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.productName}
            />
            <label className="block">unitValue</label>
            <input
              type="number"
              name="unitValue"
              placeholder="Id tienda"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.unitValue}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="block bg-indigo-500 px-2 py-1 text-white w-full rounded-md"
            >
              {isSubmitting ? "Saving..." : "Crear"}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
}

export default ProductForm;
