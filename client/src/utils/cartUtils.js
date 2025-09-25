/**
 * Cart management functions - ELIMINATES duplicated cart logic
 * Used in: OrderForm and related components
 */
export const addToCart = (cart, product, setCart) => {
  const existingProduct = cart.find((item) => item.id === product.id);

  if (existingProduct) {
    const updatedCart = cart.map((item) =>
      item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
    );
    setCart(updatedCart);
  } else {
    setCart([...cart, { ...product, quantity: 1, delivered: false, deliveredAt: "" }]);
  }
};

export const removeFromCart = (cart, productId, setCart) => {
  const updatedCart = cart.map((item) =>
    item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
  );
  setCart(updatedCart.filter((item) => item.quantity > 0));
};

export const addOneToCart = (cart, productId, setCart) => {
  const updatedCart = cart.map((item) =>
    item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
  );
  setCart(updatedCart);
};