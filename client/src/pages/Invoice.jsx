import { useOrders } from "../context/OrderProvider";
import { useDeposits } from "../context/DepositsProvider";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs"; import {
    Document,
    Text,
    Page,
    StyleSheet,
    Image,
    View,
} from "@react-pdf/renderer";
import { safeJSONParse } from '../utils/jsonUtils';
import { sortProductsByDateDesc } from '../utils/orderUtils';

const styles = StyleSheet.create({
    page: {
        backgroundColor: "#E4E4E4",
        padding: 30,
    },
    title: {
        fontSize: 24,
        textAlign: "center",
        fontWeight: "bold",
    },
    section: {
        display: "flex",
        flexDirection: "row",
        margin: 10,
        padding: 10,
    },
    parragraph: {
        fontSize: 12,
        textAlign: "justify",
        lineHeight: 1.5,
        margin: 10,
    },
    pageNumber: {
        position: "absolute",
        fontSize: 12,
        bottom: 30,
        left: 0,
        right: 0,
        textAlign: "center",
        color: "grey",
    }
});


function Invoice() {
    const params = useParams();

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

        <div className="invoice-font w-58  center">
            <div className="text-center">
                <div className="font-bold">BLACK COFFE</div>
                <div>NIT: 80743330-5</div>
                <div>CR 15 77-05 LC 1 121 A</div>
                <div>Teléfono: 3505410817</div>
                <div>R 99 PN NO APLICA OTROS</div>
                <br />
            </div>
            <div className="content">
                <div className="order-info">
                    <div>FACTURA INTERNA DE VENTA No. {order.orderId}</div>
                    <div>CLIENTE: {order.clientName} - {order.premises}</div>
                    <div>FECHA: {order.createdAt}</div>

                </div>
                <br />
                <td>NOMBRE</td>
                <td>CANTIDAD</td>
                <td>VALUR UNI.</td>
                <td>VALOR TOT.</td>
                {sortProductsByDateDesc(cart).map((product) => (
                    <tr key={product.id}>
                        <td>{product.productName}</td>
                        <td>{product.quantity}</td>
                        <td>${product.unitValue}</td>
                        <td>${product.quantity * product.unitValue}</td>
                        <br />
                    </tr>
                ))}
                <br />
                <table>
                    <tbody className="w-full">
                        <tr>
                            <td >TOTAL BRUTO:</td>
                            <td >${calculateTotal()}</td>
                        </tr>
                        <tr>
                            <td >DESCUENTO:</td>
                            <td >$0</td>
                        </tr>
                        <tr>
                            <td >TOTAL NETO:</td>
                            <td >${calculateTotal()}</td>
                        </tr>
                        <tr>
                            <td >TOTAL EXENTO:</td>
                            <td >$0</td>
                        </tr>
                        <tr>
                            <td >BASE INC 0%:</td>
                            <td >${calculateTotal()}</td>
                        </tr>
                        <tr>
                            <td >INC 0%:</td>
                            <td >$0</td>
                        </tr>
                        <tr>
                            <td >TOTAL IMPUESTO:</td>
                            <td >$0</td>
                        </tr>
                        <tr>
                            <td className="py-2 pr-4 text-right font-bold">TOTAL GENERAL:</td>
                            <td className="py-2 pr-4 text-right font-bold">${calculateTotal()}</td>
                        </tr>
                    </tbody>
                </table>
                <br />
                <table>
                    <tbody className="w-full">
                        <tr>
                            <td className="font-bold">ESTADO DE PAGO:</td>
                            <td className="font-bold">{getPaymentStatus()}</td>
                        </tr>
                        <tr>
                            <td>TOTAL ABONADO:</td>
                            <td>${order.deposit || 0}</td>
                        </tr>
                        <tr>
                            <td>DEUDA RESTANTE:</td>
                            <td>${calculateRemainingDebt()}</td>
                        </tr>
                    </tbody>
                </table>
                {deposits.length > 0 ? (
                    <>
                        <br />
                        <div className="font-bold">HISTORIAL DE PAGOS:</div>
                        <table>
                            <tbody>
                                {deposits.map((deposit, index) => (
                                    <tr key={deposit.depositId}>
                                        <td>{index + 1}.</td>
                                        <td>{deposit.depositCreatedAt.slice(0, 10)}</td>
                                        <td>{deposit.paymentMethod}</td>
                                        <td>${deposit.depositValue}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                ) : (order.deposit > 0 && (
                    <>
                        <br />
                        <div className="text-sm">
                            Nota: Abono de ${order.deposit} sin historial detallado (pago legacy).
                        </div>
                    </>
                ))}
                <br />
                CODIGO CIIU: 5613 / 4711
            </div>
        </div>
    );
}

export default Invoice;
