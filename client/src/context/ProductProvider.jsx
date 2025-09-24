import { createContext, useContext, useState } from "react";
import {
  getProductsRequest,
  deleteProductRequest,
  createProductRequest,
  getProductRequest,
  updateProductRequest,
  toggleProductDoneRequest,
} from "../api/products.api";
import { ProductContext } from "./ProductContext.jsx";

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error("useProducts must be used within a ProductContextProvider");
  }
  return context;
};


export const ProductContextProvider = ({ children }) => {
  const [products, setProducts] = useState([]);

  async function loadProducts() {
    const response = await getProductsRequest();
    setProducts(response.data);
  }

  const deleteProduct = async (id) => {
    try {
      const response = await deleteProductRequest(id);
      setProducts(products.filter((product) => product.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const createProduct = async (product) => {
    try {
      await createProductRequest(product);
      // setProducts([...products, response.data]);
    } catch (error) {
      console.error(error);
    }
  };

  const getProduct = async (id) => {
    try {
      const response = await getProductRequest(id);
      return response.data;
    } catch (error) {
      console.error(error);
    }
  };

  const updateProduct = async (id, newFields) => {
    try {
      const response = await updateProductRequest(id, newFields);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleProductDone = async (id) => {
    try {
      const productFound = products.find((product) => product.id === id);
      await toggleProductDoneRequest(id, productFound.done === 0 ? true : false);
      setProducts(
        products.map((product) =>
          product.id === id ? { ...product, done: !product.done } : product
        )
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        loadProducts,
        deleteProduct,
        createProduct,
        getProduct,
        updateProduct,
        toggleProductDone,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};
