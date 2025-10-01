import { useState, useEffect } from "react";
import { DownOutlined } from '@ant-design/icons';
import {
  shouldShowMoreButton,
  getRemainingCount,
  getInitialVisibleCount,
  getNextVisibleCount
} from '../utils/productUtils';

/**
 * Reusable progressive product list component
 * Shows products in groups of 10 with "Mostrar más" button
 *
 * @param {Object} props
 * @param {Array} props.products - Array of products to display
 * @param {Function} props.renderProduct - Function to render individual product item
 * @param {string} props.containerClass - Additional CSS classes for container
 */
function ProgressiveProductList({
  products = [],
  renderProduct,
  containerClass = ""
}) {
  const totalProducts = products.length;
  const [visibleCount, setVisibleCount] = useState(
    getInitialVisibleCount(totalProducts)
  );
  const [previousTotal, setPreviousTotal] = useState(totalProducts);

  // Handle product count changes intelligently
  useEffect(() => {
    if (totalProducts === 0) {
      // Reset when cart is empty
      setVisibleCount(0);
      setPreviousTotal(0);
    } else if (previousTotal === 0 && totalProducts > 0) {
      // Initial load of products (e.g., loading existing order)
      setVisibleCount(getInitialVisibleCount(totalProducts));
      setPreviousTotal(totalProducts);
    } else if (totalProducts > previousTotal) {
      // Products added - increment visible count by the number of new products
      const newProductsCount = totalProducts - previousTotal;
      setVisibleCount(visibleCount + newProductsCount);
      setPreviousTotal(totalProducts);
    } else if (totalProducts < previousTotal) {
      // Products removed - adjust visible count if needed
      setVisibleCount(Math.min(visibleCount, totalProducts));
      setPreviousTotal(totalProducts);
    }
  }, [totalProducts]);

  const handleShowMore = () => {
    setVisibleCount(getNextVisibleCount(visibleCount, totalProducts));
  };

  const showButton = shouldShowMoreButton(totalProducts, visibleCount);
  const remainingCount = getRemainingCount(totalProducts, visibleCount);
  const visibleProducts = products.slice(0, visibleCount);

  return (
    <div className={containerClass}>
      {/* Product List */}
      <div>
        {visibleProducts.map((product) => renderProduct(product))}
      </div>

      {/* "Mostrar más" Button */}
      {showButton && (
        <div className="flex justify-center mt-2 mb-2">
          <button
            type="button"
            onClick={handleShowMore}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2 font-medium transition-colors whitespace-nowrap"
          >
            <DownOutlined className="text-xs" />
            <span>Mostrar más ({remainingCount} producto{remainingCount !== 1 ? 's' : ''})</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ProgressiveProductList;
