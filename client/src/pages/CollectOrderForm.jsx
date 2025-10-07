import { Form, Formik } from "formik";
import { useOrders } from "../context/OrderProvider";
import { useDeposits } from "../context/DepositsProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { safeJSONParse } from '../utils/jsonUtils';
import { sortProductsByDateDesc } from '../utils/orderUtils';
import { DeleteOutlined } from "@ant-design/icons";
import { Modal, message } from "antd";
import ProgressiveProductList from '../components/ProgressiveProductList';
import CoffeePouringAnimation from '../components/CoffeePouringAnimation';

function CollectOrderForm() {

  const { getOrder, updateOrder, markOrderAsAbandoned } = useOrders();
  const { getDepositsByOrderId, createDeposit, deleteDepositById } = useDeposits();
  const [client, setClient] = useState([]);
  const [cart, setCart] = useState([]);
  const [deposit, setDeposit] = useState(0);
  const [order, setOrder] = useState({
    clientId: "",
    shopId: "1",
    items: ""
  });
  const [deposits, setDeposits] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [pendingActions, setPendingActions] = useState(null);
  const [modalPaymentInfo, setModalPaymentInfo] = useState({
    depositAmount: 0,
    currentDebt: 0,
    newDebt: 0
  });
  const params = useParams();
  const navigate = useNavigate();
  const [platformPayment, setPlatformPayment] = useState(false);
  const fechaActual = dayjs().format('YYYY-MM-DD');
  const [depositedTotal, setDepositedTotal] = useState(false);
  const [isDeletingDeposit, setIsDeletingDeposit] = useState(false);
  const [showDeposits, setShowDeposits] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");


  const handleCheckboxChange = async (itemId) => {
    setCart((prevCart) => {
      const updatedCart = prevCart.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            delivered: !item.delivered,
            deliveredAt: fechaActual
          };
        }
        return item;
      });

      var values = {};
      values.items = JSON.stringify(updatedCart);

      // Call async function here (in this case, updateOrder)
      updateOrder(params.id, values);

      return updatedCart;
    });
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.unitValue * item.quantity, 0);
  };

  function togglePlatform() {
    setPlatformPayment(!platformPayment); // Change value from true to false and vice versa
  }


  function depositTotal() {
    setDepositedTotal(true);
    setDeposit(calculateTotal() - order.deposit)
  }

  const handleDeleteDeposit = async (depositId, depositValue) => {
    // Check if order is paid
    if (order.paid === 1) {
      message.error(
        "No se puede eliminar un depósito de una orden que ya está pagada completamente"
      );
      return;
    }

    Modal.confirm({
      title: "¿Está seguro de eliminar este depósito?",
      content: `Depósito de $${depositValue.toLocaleString()} - Esta acción no se puede deshacer.`,
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        setIsDeletingDeposit(true);
        setLoadingMessage("Eliminando abono");
        try {
          await deleteDepositById(depositId);
          message.success("Depósito eliminado correctamente");
          // Reload the page to refresh order and deposits data
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (error) {
          message.error("Error al eliminar el depósito");
          console.error(error);
          setIsDeletingDeposit(false);
          setLoadingMessage("");
        }
      },
    });
  };

  const calculateModalInfo = (values) => {
    const totalAmount = calculateTotal();
    const currentDebt = totalAmount - order.deposit;

    // Calculate deposit amount based on whether it's total payment or partial
    let depositAmount;
    if (depositedTotal) {
      depositAmount = deposit; // This is calculateTotal() - order.deposit
    } else {
      depositAmount = parseFloat(values.deposit) || 0;
    }

    const newDebt = Math.max(0, currentDebt - depositAmount);

    return {
      depositAmount,
      currentDebt,
      newDebt
    };
  };

  const handleFormSubmit = async (values, actions) => {
    // Validation: Check if there's a valid deposit amount
    let hasValidDeposit = false;
    let depositAmount = 0;

    if (depositedTotal && deposit > 0) {
      hasValidDeposit = true;
      depositAmount = deposit;
    } else if (!depositedTotal && values.deposit && parseFloat(values.deposit) > 0) {
      hasValidDeposit = true;
      depositAmount = parseFloat(values.deposit);
    }

    // Prevent modal from showing if there's no valid deposit
    if (!hasValidDeposit) {
      alert("Por favor, ingrese un valor válido para el depósito");
      return;
    }

    // Calculate payment information for modal
    const paymentInfo = calculateModalInfo(values);
    setModalPaymentInfo(paymentInfo);

    // Store the form data and actions for later use
    setPendingFormData(values);
    setPendingActions(actions);
    setShowConfirmModal(true);
  };

  const handleConfirmPayment = async () => {
    setShowConfirmModal(false);
    setIsRegistering(true);
    setLoadingMessage("Registrando abono");

    if (!pendingFormData || !pendingActions) return;

    const values = pendingFormData;
    const actions = pendingActions;

    // Original submission logic
    values.shopId = 1;
    values.clientId = client;
    values.items = JSON.stringify(cart)

    // Calculate the individual deposit amount (not cumulative)
    const individualDepositAmount = depositedTotal ? deposit : parseFloat(values.deposit);

    // Calculate new cumulative total after this deposit
    const newCumulativeTotal = order.deposit + individualDepositAmount;

    var neewDeposit = {};
    neewDeposit.orderId = params.id;
    neewDeposit.clientId = order.clientId;
    neewDeposit.paymentMethod = platformPayment ? 'Plataforma' : 'Efectivo';
    neewDeposit.lastDeposit = order.deposit > 0 ? order.deposit : 0; // Previous cumulative total
    neewDeposit.depositValue = individualDepositAmount; // Individual payment amount (what user entered)
    neewDeposit.newDeposit = newCumulativeTotal; // New cumulative total after this deposit
    neewDeposit.dueOnDeposit = calculateTotal() - newCumulativeTotal; // Remaining debt

    // Update order deposit total
    values.deposit = newCumulativeTotal;

    if (values.deposit >= calculateTotal()) {
      values.paid = 1;
    } else {
      values.paid = 0;
    }

    values.paidAt = fechaActual;
    if (params.id) {
      delete values.clientName;
      delete values.premises;
      delete values.createdAt;
      delete values.clientId;
      delete values.items;
      delete values.shopId;

      try {
        console.log('[CollectOrderForm] Creating deposit:', neewDeposit);
        await createDeposit(neewDeposit);
        console.log('[CollectOrderForm] Deposit created successfully');

        console.log('[CollectOrderForm] Updating order:', values);
        await updateOrder(params.id, values);
        console.log('[CollectOrderForm] Order updated successfully');
      } catch (error) {
        console.error('[CollectOrderForm] ERROR during payment processing:', error);
        alert(`Error al procesar el pago: ${error.message || 'Error desconocido'}. Por favor, verifique si el pago fue registrado correctamente.`);
        setIsRegistering(false);
        setLoadingMessage("");
        return; // Don't reload if there was an error
      }
    }

    // Reset form and states after successful transaction
    setOrder({ order });
    setDepositedTotal(false); // Reset total deposit flag
    setDeposit(0); // Reset deposit amount

    // Reset form field using Formik's resetForm
    if (pendingActions && pendingActions.resetForm) {
      pendingActions.resetForm({
        values: {
          ...pendingFormData,
          deposit: "" // Clear the deposit field
        }
      });
    }

    setTimeout(() => {
      window.location.reload();
    }, 2000);

    // Clear pending data
    setPendingFormData(null);
    setPendingActions(null);
  };

  const handleCancelPayment = () => {
    setShowConfirmModal(false);
    setPendingFormData(null);
    setPendingActions(null);
    // Reset depositedTotal flag if user cancels
    setDepositedTotal(false);
    setDeposit(0);
  };

  useEffect(() => {
    const loadOrder = async () => {
      if (params.id) {
        try {
          const order = await getOrder(params.id);
          console.log(order)
          const depositsRequest = await getDepositsByOrderId(params.id);

          // Check if order exists
          if (!order) {
            console.error('[CollectOrderForm] Order not found:', params.id);
            alert('No se pudo cargar la orden. Por favor, verifique la conexión al servidor.');
            return;
          }

          setDeposits(depositsRequest || []);
          setCart(safeJSONParse(order.items, []))
          if (order.paymentMethod == "Plataforma") {
            togglePlatform(true)
          }
          if (order.paid) {
            setOrder({
              clientId: order.clientId,
              shopId: 1,
              items: cart,
              clientName: order.clientName,
              premises: order.premises,
              createdAt: order.createdAt.slice(0, 10),
              paid: order.paid,
              paidAt: order.paidAt.slice(0, 10),
              deposit: order.deposit,
              collectedBy: order.mall
            });
          } else {
            setOrder({
              clientId: order.clientId,
              shopId: 1,
              items: cart,
              clientName: order.clientName,
              premises: order.premises,
              createdAt: order.createdAt.slice(0, 10),
              paid: order.paid,
              deposit: order.deposit,
              collectedBy: order.mall
            });
          }
        } catch (error) {
          console.error('[CollectOrderForm] Error loading order:', error);
          alert('Error al cargar la orden. Por favor, verifique la conexión al servidor e intente nuevamente.');
        }
      }
    };
    loadOrder();

    // Reset states when component mounts to ensure clean state
    setDepositedTotal(false);
    setDeposit(0);
  }, [params.id]); // Reset when navigating to different order

  return (
    <div>
      {/* Loading Overlay */}
      {(isRegistering || isDeletingDeposit) && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm mx-4">
            <div className="flex flex-col items-center">
              <CoffeePouringAnimation />
              <h2 className="text-xl font-bold text-gray-800 text-center">
                {loadingMessage}
              </h2>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Por favor espere...
              </p>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-xl font-bold uppercase text-center">
        {order.paid ? 'ORDEN COBRADA' : 'COBRAR/ABONAR ORDEN'}
      </h1>
      <h1 className="text-xl font-bold uppercase text-center">
        {order.premises} - {order.clientName} / {order.createdAt}
      </h1>

      {order.paid ? <h1 className="text-xl font-bold uppercase text-center">Dia de pago: {order.paidAt}  </h1> : ''}

      {/* Abandoned Order Warning Banner */}
      {order.isAbandoned === 1 && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 mt-4" role="alert">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-bold">⚠️ ORDEN ABANDONADA</p>
              {order.abandonReason && (
                <p className="text-xs mt-1">Razón: {order.abandonReason}</p>
              )}
              {order.abandonedAt && (
                <p className="text-xs">Abandonada: {dayjs(order.abandonedAt).format('DD/MM/YYYY HH:mm')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Confirmation Modal with Payment Details */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div
            className="bg-white rounded-lg shadow-2xl absolute"
            style={{
              top: '80px', // Just below navbar
              left: '16px',
              right: '16px',
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 96px)',
              overflow: 'auto'
            }}
          >
            <div className="p-4">
              <h3 className="text-base font-bold text-center mb-3 text-gray-800">
                Confirmar abono a cuenta?
              </h3>

              {/* Payment Information Display */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium text-sm">Deuda actual:</span>
                  <span className="text-red-600 font-bold text-sm">
                    ${modalPaymentInfo.currentDebt.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium text-sm">Valor a depositar:</span>
                  <span className="text-green-600 font-bold text-base">
                    ${modalPaymentInfo.depositAmount > 0 ? modalPaymentInfo.depositAmount.toLocaleString() : '0'}
                  </span>
                </div>

                <hr className="border-gray-300" />

                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-bold text-sm">Nueva deuda:</span>
                  <span className={`font-bold text-base ${modalPaymentInfo.newDebt === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    ${modalPaymentInfo.newDebt.toLocaleString()}
                  </span>
                </div>

                {modalPaymentInfo.newDebt === 0 && (
                  <div className="text-center mt-2">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                      ¡Orden completamente pagada!
                    </span>
                  </div>
                )}

                {modalPaymentInfo.depositAmount === 0 && (
                  <div className="text-center mt-2">
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                      ⚠️ No se ha ingresado un valor válido
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col space-y-2">
                <button
                  onClick={handleConfirmPayment}
                  disabled={modalPaymentInfo.depositAmount === 0}
                  className={`w-full px-4 py-2 rounded-md font-medium transition-colors text-sm ${modalPaymentInfo.depositAmount === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                >
                  Confirmar
                </button>
                <button
                  onClick={handleCancelPayment}
                  className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Formik
        initialValues={{ ...order, deposit: "" }} // Always start with empty deposit field
        enableReinitialize={true}
        validate={values => {
          const inputValue = parseFloat(values.deposit);
          const maxAllowed = calculateTotal() - order.deposit;

          if (values.deposit !== "" && inputValue < 0) {
            alert("Por favor, ingrese un valor positivo.");
            return { deposit: "Por favor, ingrese un valor positivo." };
          } else if (values.deposit !== "" && inputValue > maxAllowed) {
            alert(`El valor ingresado no puede ser mayor a ${maxAllowed}.`);
            return { deposit: `El valor ingresado no puede ser mayor a ${maxAllowed}.` };
          }

          return {};
        }}
        onSubmit={handleFormSubmit}
      >
        {({ handleChange, handleSubmit, values, isSubmitting, setFieldValue }) => (
          <Form
            onSubmit={handleSubmit}
            className="bg-blue-400 rounded-md p-4 mx-auto mt-10">
            <div className="grid items-center py-1 ">
              <div>
                <p className="text-white-400"><b>Valor total: ${calculateTotal()}</b></p>
                {order.deposit && calculateTotal() - order.deposit ? <p className="font-bold">Abonado: ${order.deposit}</p> : ''}
                {calculateTotal() - order.deposit ? <p className="text-red-600 font-bold">Debe: ${calculateTotal() - order.deposit}</p> : ''}
              </div>
              {!platformPayment && order.paid ? '' : <button type="button" style={{
                backgroundColor: platformPayment == true ? '#A6C4F0' : '#F3F1F1',
              }}
                className="bg-indigo-500 px-2 py-1 text-black rounded-md ml-auto" onClick={() => togglePlatform()}>Plataforma</button>}
              {order.paid ? <><button
                type="button"
                onClick={() => navigate(`../pdfOrden/` + params.id)}
                className="block bg-indigo-500 px-2 my-2 py-1 text-white w-20% rounded-md ml-auto"              >
                {'Generar Factura'}
              </button>
                <button
                  type="button"
                  className="block bg-indigo-500 px-2 my-2 py-1 text-white w-20% rounded-md ml-auto"              >
                  <a href={"whatsapp://send?text=Puedes consultar tu factura aquí: https://blackcofeepedidos.onrender.com/factura/" + params.id} data-action="share/whatsapp/share" >Compartir en WhatsApp</a>
                </button>
                <button
                  type="button"
                  className="block bg-indigo-500 px-2 my-2 py-1 text-white w-20% rounded-md ml-auto"              >
                  {'Orden Cobrada'}
                </button></> :
                <>
                  <button
                    type="button"
                    onClick={() => navigate(`../pdfOrden/` + params.id)}
                    className="block bg-indigo-500 px-2 my-2 py-1 text-white w-20% rounded-md ml-auto"              >
                    {'Generar Factura'}
                  </button>
                  <button
                    type="button"
                    className="block bg-indigo-500 px-2 my-2 py-1 text-white w-20% rounded-md ml-auto"              >
                    <a href={"whatsapp://send?text=Puedes consultar tu factura aquí: https://blackcofeepedidos.onrender.com/factura/" + params.id} data-action="share/whatsapp/share" >Compartir en WhatsApp</a>
                  </button><input
                    type="number"
                    name="deposit"
                    placeholder="Ej: $10.000"
                    value={values.deposit}
                    className="m-2 px-2 py-1 rounded-sm rounded"
                    onChange={handleChange}
                  />
                  {/*<button
                    type="button"
                    onClick={() => {
                      depositTotal();
                      // Clear the input field when using total payment
                      setFieldValue('deposit', '');
                    }}
                    disabled={isSubmitting}
                    className="block bg-indigo-500 my-1 px-2 py-1 text-white w-20% rounded-md ml-auto"  >
                    Cobrar Total
                  </button>*/}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="block bg-indigo-500 px-2 py-1 text-white w-20% rounded-md ml-auto"              >
                    {isSubmitting ? "Cobrando Orden..." : "Cobrar Orden"}
                  </button></>
              }

            </div>
            <ProgressiveProductList
              products={sortProductsByDateDesc(cart)}
              renderProduct={(item) => (
                <div key={item.id} className="bg-stone-100 rounded-md m-2 flex font-bold">
                  <input
                    type="checkbox"
                    className="ml-2"
                    value={item.delivered}
                    checked={item.delivered}
                    onChange={() => handleCheckboxChange(item.id)}
                  />
                  <p className="flex items-center px-2">{item.productName} - ({item.quantity})</p>
                  <p className="p-2 text-sm text-gray-700 flex items-center justify-center font-bold h-content">
                    {item.id.slice(-14)}
                  </p>
                  <p className="sticky right-0 text-green-500 px-2 py-1 ml-auto">${item.quantity * item.unitValue}</p>
                </div>
              )}
            />
            {deposits && deposits.length > 0 ? <>
              <div className="flex justify-center mt-2 mb-2">
                <button
                  type="button"
                  onClick={() => setShowDeposits(!showDeposits)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md font-medium transition-colors whitespace-nowrap"
                >
                  {showDeposits ? 'Ocultar Abonos' : `Mostrar Abonos (${deposits.length})`}
                </button>
              </div>
              {showDeposits && (
                <>
                  <h3 className="font-bold text-lg mb-2">Abonos de esta orden:</h3>
                  <table className="border-collapse w-full border-2 border-gray-500 m-2">
                    <thead>
                      <tr className="bg-stone-200 text-gray-700 font-bold">
                        <th className="px-2 py-1">Valor de Abono</th>
                        <th className="px-2 py-1">Valor Abonado Anterior</th>
                        <th className="px-2 py-1">Abono de la Orden</th>
                        <th className="px-2 py-1">Nueva Deuda</th>
                        <th className="px-2 py-1">Fecha Abono</th>
                        <th className="px-2 py-1">Método de Pago</th>
                        <th className="px-2 py-1">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.map((deposit) => (
                        <tr
                          key={deposit.depositId}
                          className={
                            deposit.isDeleted
                              ? "bg-red-50 opacity-60 line-through"
                              : "bg-stone-100 text-gray-700 hover:bg-gray-200"
                          }
                        >
                          <td className="text-green-400 px-2 py-1 text-center">
                            +${deposit.depositValue?.toLocaleString()}
                          </td>
                          <td className="px-2 py-1 text-center">
                            ${deposit.lastDeposit?.toLocaleString()}
                          </td>
                          <td className="px-2 py-1 text-center">
                            ${deposit.newDeposit?.toLocaleString()}
                          </td>
                          <td className="px-2 py-1 text-center">
                            ${deposit.dueOnDeposit?.toLocaleString()}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {deposit.depositCreatedAt.slice(11, 16) + ' ' + deposit.depositCreatedAt.slice(2, 10)}
                          </td>
                          <td className="px-2 py-1 text-center">{deposit.paymentMeethd}</td>
                          <td className="px-2 py-1 text-center">
                            {deposit.isDeleted ? (
                              <span className="text-red-500 text-sm font-bold">[ELIMINADO]</span>
                            ) : (
                              <button
                                type="button"
                                className="bg-red-400 hover:bg-red-500 text-white px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() =>
                                  handleDeleteDeposit(deposit.depositId, deposit.depositValue)
                                }
                                disabled={isDeletingDeposit || order.paid === 1}
                                title={
                                  order.paid === 1
                                    ? "No se puede eliminar - Orden pagada"
                                    : "Eliminar depósito"
                                }
                              >
                                <DeleteOutlined />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
              : ''}

            {/* Mark as Abandoned Section */}
            {!order.paid && !order.isAbandoned && (
              <div className="mt-4 pt-4 border-t-2 border-gray-300">
                <button
                  type="button"
                  onClick={() => {
                    const abandonReason = prompt(
                      "¿Por qué se abandona esta orden? (Opcional)\n\nEjemplos: Cliente canceló, No respondió llamadas, etc."
                    );

                    Modal.confirm({
                      title: '¿Marcar esta orden como abandonada?',
                      content: (
                        <div>
                          <p>La orden dejará de aparecer en "Cuentas por cobrar"</p>
                          {abandonReason && (
                            <p className="mt-2">
                              <strong>Razón:</strong> {abandonReason}
                            </p>
                          )}
                        </div>
                      ),
                      okText: 'Marcar como abandonada',
                      okType: 'danger',
                      cancelText: 'Cancelar',
                      onOk: async () => {
                        try {
                          // Get user data from localStorage with fallback
                          let userName = 'Unknown';
                          const userDataString = localStorage.getItem('user');

                          if (userDataString) {
                            // Check if it's already a plain string (no quotes or curly braces)
                            if (!userDataString.startsWith('{') && !userDataString.startsWith('"')) {
                              // It's a plain string, use it directly
                              userName = userDataString;
                            } else {
                              try {
                                // Try to parse as JSON
                                const userData = JSON.parse(userDataString);
                                userName = userData?.name || userData || userDataString;
                              } catch (parseError) {
                                // If it's a quoted string like "Unilago", remove quotes
                                userName = userDataString.replace(/^"|"$/g, '');
                              }
                            }
                          }

                          await markOrderAsAbandoned(params.id, {
                            abandonReason: abandonReason || 'Sin razón especificada',
                            abandonedBy: userName
                          });
                          message.success('Orden marcada como abandonada');
                          setTimeout(() => {
                            navigate('/');
                          }, 1500);
                        } catch (error) {
                          message.error('Error al marcar orden como abandonada');
                          console.error(error);
                        }
                      },
                    });
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Marcar como Abandonada
                </button>
              </div>
            )}
          </Form>
        )
        }
      </Formik >
    </div >
  );
}

export default CollectOrderForm;