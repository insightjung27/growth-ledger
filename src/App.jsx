import { Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import PinGate from "./components/PinGate.jsx";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Decisions from "./pages/Decisions.jsx";
import DecisionDetail from "./pages/DecisionDetail.jsx";
import Deals from "./pages/Deals.jsx";
import DealDetail from "./pages/DealDetail.jsx";
import MoneyTest from "./pages/MoneyTest.jsx";
import Team from "./pages/Team.jsx";
import TeamDetail from "./pages/TeamDetail.jsx";
import Handoffs from "./pages/Handoffs.jsx";
import HandoffDetail from "./pages/HandoffDetail.jsx";
import OneOnOnes from "./pages/OneOnOnes.jsx";
import Weekly from "./pages/Weekly.jsx";
import Growth from "./pages/Growth.jsx";
import Guide from "./pages/Guide.jsx";

export default function App() {
  return (
    <ErrorBoundary>
      <PinGate>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="decisions" element={<Decisions />} />
            <Route path="decisions/:id" element={<DecisionDetail />} />
            <Route path="deals" element={<Deals />} />
            <Route path="deals/:id" element={<DealDetail />} />
            <Route path="money-test" element={<MoneyTest />} />
            <Route path="money-test/:id" element={<MoneyTest />} />
            <Route path="team" element={<Team />} />
            <Route path="team/:id" element={<TeamDetail />} />
            <Route path="handoffs" element={<Handoffs />} />
            <Route path="handoffs/:id" element={<HandoffDetail />} />
            <Route path="one-on-ones" element={<OneOnOnes />} />
            <Route path="weekly" element={<Weekly />} />
            <Route path="growth" element={<Growth />} />
            <Route path="guide" element={<Guide />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </PinGate>
    </ErrorBoundary>
  );
}
