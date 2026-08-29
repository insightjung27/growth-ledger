import { Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import PinGate from "./components/PinGate.jsx";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Deals from "./pages/Deals.jsx";
import DealDetail from "./pages/DealDetail.jsx";
import MoneyTest from "./pages/MoneyTest.jsx";
import Weekly from "./pages/Weekly.jsx";
import Growth from "./pages/Growth.jsx";

export default function App() {
  return (
    <ErrorBoundary>
    <PinGate>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="deals" element={<Deals />} />
        <Route path="deals/:id" element={<DealDetail />} />
        <Route path="money-test" element={<MoneyTest />} />
        <Route path="money-test/:id" element={<MoneyTest />} />
        <Route path="weekly" element={<Weekly />} />
        <Route path="growth" element={<Growth />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
    </PinGate>
    </ErrorBoundary>
  );
}
