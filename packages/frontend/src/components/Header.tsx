import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export const Header = () => {
  const { data: walletData } = useAccount();
  return (
    <>
      <div style={{ marginTop: "103px", marginLeft: "124px" }}>
        <img src="/covered_strangle.svg" alt="" width="533" />
        <br />
        <img src="/strategy_on_lyra.svg" alt="" />
      </div>
      <div style={{ position: "absolute", top: "33px", right: "56px" }}>
        {walletData && (
          <ConnectButton
            chainStatus="name"
            accountStatus="address"
            showBalance={false}
          />
        )}
      </div>
    </>
  );
};
