import { useOrders } from "../context/OrderProvider";
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
    const [cart, setCart] = useState([]);
    const [order, setOrder] = useState({
    });

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + item.unitValue * item.quantity, 0);
    };

    useEffect(() => {
        const loadOrder = async () => {
            if (params.id) {
                const order = await getOrder(params.id);
                setTimeout(() => {
                }, 3000);
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
                setCart(JSON.parse(order.items))


            }
        };
        loadOrder();
    }, [order]);
    console.log(cart, order)

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
                {cart.map((product) => (
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
                CODIGO CIIU: 5613 / 4711
            </div>
        </div>
    );
}

export default Invoice;
