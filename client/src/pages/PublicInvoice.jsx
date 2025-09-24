import { useOrders } from "../context/OrderProvider";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { safeJSONParse } from '../utils/jsonUtils';

function PublicInvoice() {
    const params = useParams();
    const myPrintFunction = () => {
        window.print();
    }

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
    }, []);

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
                        {cart.map((product) => (
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
                    <div className="mt-8">CODIGO CIIU: 5613 / 4711</div>
                </div>
            </div>
        </div>
    );
}

export default PublicInvoice;
