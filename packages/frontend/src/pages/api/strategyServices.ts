export interface StrategyDetails {
    deposit: number;
    capacity: number;
    currency: string;
    cycleNumber: number;
    startTime: Date;
    endTime: Date;
    collateralDescription: string;
    optionsPositions: string;
}

export const getCurrentStrategy = (): StrategyDetails => {
    return <StrategyDetails>{
        deposit: 400000,
        capacity: 9000000,
        currency: "USDC",
        cycleNumber: 5,
        startTime: getLastFriday(),
        endTime: getNextFriday(),
        collateralDescription: "1 ETH + 2500 USDC",
        optionsPositions: "Call (50 contracts) - 3000 USDS strike. Put (50 contracts) - 2000 USDS strike",
    };
};

export const getLastFriday = (): Date => {
    const weekAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
    return getNextFriday(weekAgo);
};

export const getNextFriday = (date = new Date()): Date => {
    const dateCopy = new Date(date.getTime());
    const nextFriday = new Date(dateCopy.setDate(dateCopy.getDate() + ((7 - dateCopy.getDay() + 5) % 7 || 7)));
    return nextFriday;
};
