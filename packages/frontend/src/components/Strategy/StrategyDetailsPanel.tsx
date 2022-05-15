import { StrategyDetails } from "../../pages/api/strategyServices";
import StrategyCap from "./StrategyCap";
import StrategyPeriodAndCollateral from "./StrategyPeriodAndCollateral";

interface Props {
    strategyDetails: StrategyDetails;
}

const StrategyDetailsPanel = ({ strategyDetails }: Props) => (
    <>
        <StrategyCap
            currentBalance={strategyDetails.deposit}
            cap={strategyDetails.capacity}
            currency={strategyDetails.currency}
        />
        <StrategyPeriodAndCollateral
            cycleNumber={strategyDetails.cycleNumber}
            startTime={strategyDetails.startTime}
            endTime={strategyDetails.endTime}
            collateral={strategyDetails.collateralDescription}
        />
    </>
);

export default StrategyDetailsPanel;
