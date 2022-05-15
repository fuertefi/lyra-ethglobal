import { format } from "date-fns";
import { StrategyDetails } from "../../pages/api/strategyServices";
import DoubleColumnPanel from "./DoubleColumnPanel";
import SingleColumnPanel from "./SingleColumnPanel";
import StrategyCap from "./StrategyCap";

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
        <DoubleColumnPanel
           headline1={`Current Period: ${strategyDetails.cycleNumber}`}
           text1={`${format(strategyDetails.startTime, "MMM dd")} - ${format(strategyDetails.endTime, "MMM dd")}`}
           tooltip1={"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}
           headline2={"Strategy Collateral"}
           text2={strategyDetails.collateralDescription}
           tooltip2={"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}
        />
        <DoubleColumnPanel
           headline1={`Current ETH Price`}
           text1={`2500 USD`}
           tooltip1={"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}
           headline2={"Another Parameter"}
           text2={`Some value`}
           tooltip2={"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}
        />
        <SingleColumnPanel
            headline={"Options Positions"}
            text={strategyDetails.optionsPositions}
            tooltip={"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}
        />
    </>
);

export default StrategyDetailsPanel;
