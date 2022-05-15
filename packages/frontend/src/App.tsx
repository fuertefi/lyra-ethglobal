import "@rainbow-me/rainbowkit/styles.css";
import {
  apiProvider,
  configureChains,
  darkTheme,
  getDefaultWallets,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import { chain, createClient, WagmiProvider } from "wagmi";
import { createGlobalStyle, ThemeProvider } from "styled-components";
import { Layout } from "./components/Layout";
import { Main } from "./pages/Main";
import "./antd.css";
import { theme } from "./theme";

const GlobalStyle = createGlobalStyle`
  body {
     font-family: serif;
     background: #000;
     color: #99A0AB;
     font-family: 'Satoshi', sans-serif;
  }

  header {
    color: white;
  }
  

  @keyframes buttonHoverIn {
    0% {
      background-position: 0;
    }
    100% {
      background-position: 0 -50px;
    }
  }

  @keyframes buttonHoverOut {
    0% {
      background-position: 0 -50px;
    }
    100% {
      background-position: 0;
    }
  }
`;

const { chains, provider } = configureChains(
  [chain.optimism],
  [apiProvider.alchemy(process.env.ALCHEMY_ID), apiProvider.fallback()]
);

const { connectors } = getDefaultWallets({
  appName: "lyra-ethglobal",
  chains,
});

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
});

function App() {
  return (
    <WagmiProvider client={wagmiClient}>
      <RainbowKitProvider
        chains={chains}
        theme={darkTheme({
          accentColor: "#06C799",
          accentColorForeground: "black",
          borderRadius: "large",
          fontStack: "system",
        })}
      >
        <ThemeProvider theme={theme}>
          <GlobalStyle />
          <Layout>
            <Main />
          </Layout>
        </ThemeProvider>
      </RainbowKitProvider>
    </WagmiProvider>
  );
}

export default App;
