import { useOrders } from "../context/OrderProvider";
import { useDeposits } from "../context/DepositsProvider";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { safeJSONParse } from '../utils/jsonUtils';
import { sortProductsByDateDesc } from '../utils/orderUtils';

function PublicInvoice() {
    const params = useParams();
    const myPrintFunction = () => {
        window.print();
    }

    const { getOrder } = useOrders();
    const { getDepositsByOrderId } = useDeposits();
    const [cart, setCart] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [order, setOrder] = useState({
    });

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + item.unitValue * item.quantity, 0);
    };

    const calculateRemainingDebt = () => {
        return calculateTotal() - (order.deposit || 0);
    };

    const getPaymentStatus = () => {
        const debt = calculateRemainingDebt();
        if (debt <= 0) return "PAGADO COMPLETAMENTE";
        if (order.deposit > 0) return "PAGO PARCIAL";
        return "NO PAGADO";
    };

    const getPaymentStatusColor = () => {
        const debt = calculateRemainingDebt();
        if (debt <= 0) return "text-green-600 font-bold";
        if (order.deposit > 0) return "text-yellow-600 font-bold";
        return "text-red-600 font-bold";
    };

    useEffect(() => {
        const loadOrder = async () => {
            if (params.id) {
                const order = await getOrder(params.id);
                const depositsData = await getDepositsByOrderId(params.id);

                setDeposits(depositsData || []);
                setCart(safeJSONParse(order.items, []))

                order.paid ?
                    setOrder({
                        orderId: order.id,
                        clientId: order.clientId,
                        shopId: 1,
                        items: cart,
                        clientName: order.clientName,
                        premises: order.premises,
                        createdAt: order.createdAt.slice(0, 10),
                        paid: order.paid,
                        paidAt: order.paidAt.slice(0, 10),
                        deposit: order.deposit
                    }) : setOrder({
                        orderId: order.id,
                        clientId: order.clientId,
                        shopId: 1,
                        items: cart,
                        clientName: order.clientName,
                        premises: order.premises,
                        createdAt: order.createdAt.slice(0, 10),
                        deposit: order.deposit
                    })
            }
        };

        loadOrder();
    }, [params.id]);

    return (
        <div className="container mx-auto bg-white">
            <div className="text-center flex justify-between">
                <div>
                    <h1 className="text-2xl font-bold">BLACK COFFEE</h1>
                    <div>NIT: 80743330-5</div>
                    <div>CR 15 77-05 LC 1 121</div>
                    <div>Teléfono: 3505410817</div>
                    <div>R 99 PN NO APLICA OTROS</div>
                </div>
                <div>
                    <button onClick={myPrintFunction} id="print" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                        Imprimir
                    </button>
                </div>
            </div>
            <div className="mt-8">
                <div className="text-left">
                    <div className="font-bold">FACTURA INTERNA DE VENTA No. {order.orderId}</div>
                    <div>CLIENTE: {order.clientName} - {order.premises}</div>
                    <div>FECHA: {order.createdAt}</div>
                </div>
                <table className="w-full mt-8 border-collapse border border-black">
                    <thead>
                        <tr>
                            <th className="py-2 border border-black text-center">NOMBRE (CANTIDAD)</th>
                            <th className="py-2 border border-black text-center">VALOR TOTAL</th>
                            <th className="py-2 border border-black text-center">PEDIDO A LAS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortProductsByDateDesc(cart).map((product) => (
                            <tr key={product.id}>
                                <td className="py-2 border border-black text-center">{product.productName} ({product.quantity})</td>
                                <td className="py-2 border border-black text-center">${product.quantity * product.unitValue}</td>
                                <td className="py-2 border border-black text-center">{product.id.slice(-14)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="mt-8">
                    <table className="w-full">
                        <tbody>
                            <tr>
                                <td className="py-2">TOTAL BRUTO:</td>
                                <td className="py-2">${calculateTotal()}</td>
                            </tr>
                            <tr>
                                <td className="py-2">DESCUENTO:</td>
                                <td className="py-2">$0.00</td>
                            </tr>
                            <tr>
                                <td className="py-2">TOTAL NETO:</td>
                                <td className="py-2">${calculateTotal()}</td>
                            </tr>
                            <tr>
                                <td className="py-2">TOTAL EXENTO:</td>
                                <td className="py-2">$0.00</td>
                            </tr>
                            <tr>
                                <td className="py-2">BASE INC 0%:</td>
                                <td className="py-2">${calculateTotal()}</td>
                            </tr>
                            <tr>
                                <td className="py-2">INC 0%:</td>
                                <td className="py-2">$0.00</td>
                            </tr>
                            <tr>
                                <td className="py-2 font-bold">TOTAL IMPUESTO:</td>
                                <td className="py-2 font-bold">$0.00</td>
                            </tr>
                            <tr>
                                <td className="py-2 font-bold">TOTAL GENERAL:</td>
                                <td className="py-2 font-bold">${calculateTotal()}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="mt-8 border-t-2 border-black pt-4">
                        <h2 className="text-xl font-bold mb-4">INFORMACIÓN DE PAGO</h2>
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="py-2 font-bold">ESTADO DE PAGO:</td>
                                    <td className={`py-2 ${getPaymentStatusColor()}`}>{getPaymentStatus()}</td>
                                </tr>
                                <tr>
                                    <td className="py-2">TOTAL ABONADO:</td>
                                    <td className="py-2 text-green-600 font-bold">${order.deposit || 0}</td>
                                </tr>
                                <tr>
                                    <td className="py-2">DEUDA RESTANTE:</td>
                                    <td className={`py-2 font-bold ${calculateRemainingDebt() > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ${calculateRemainingDebt()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {deposits.length > 0 ? (
                            <div className="mt-6">
                                <h3 className="text-lg font-bold mb-2">HISTORIAL DE PAGOS</h3>
                                <table className="w-full border-collapse border border-black">
                                    <thead>
                                        <tr>
                                            <th className="py-2 border border-black">#</th>
                                            <th className="py-2 border border-black">FECHA</th>
                                            <th className="py-2 border border-black">MÉTODO</th>
                                            <th className="py-2 border border-black">MONTO</th>
                                            <th className="py-2 border border-black">TOTAL ACUMULADO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deposits.map((deposit, index) => (
                                            <tr key={deposit.depositId}>
                                                <td className="py-2 border border-black text-center">{index + 1}</td>
                                                <td className="py-2 border border-black text-center">
                                                    {deposit.depositCreatedAt.slice(0, 10)}
                                                </td>
                                                <td className="py-2 border border-black text-center">
                                                    {deposit.paymentMethod}
                                                </td>
                                                <td className="py-2 border border-black text-center">
                                                    ${deposit.depositValue}
                                                </td>
                                                <td className="py-2 border border-black text-center">
                                                    ${deposit.newDeposit}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (order.deposit > 0 && (
                            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-300 rounded">
                                <p className="text-sm text-yellow-800">
                                    <span className="font-bold">Nota:</span> Este pedido tiene un abono registrado de ${order.deposit},
                                    pero no hay historial de pagos detallado disponible.
                                    Es posible que sea un pago anterior al sistema de seguimiento de depósitos.
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8">CODIGO CIIU: 5613 / 4711</div>
                </div>
            </div>
        </div>
    );
}

export default PublicInvoice;
