import { ApolloProvider } from "@apollo/client";
import {
  apiProvider,
  configureChains,
  darkTheme,
  getDefaultWallets,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { useMemo } from "react";
import { createGlobalStyle, ThemeProvider } from "styled-components";
import { chain, createClient, WagmiProvider } from "wagmi";
import "./antd.css";
import { Layout } from "./components/Layout";
import { Main } from "./pages/Main";
import { theme } from "./theme";
import { hackMoneyClient } from "./utils/apollo-client";

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
  [chain.optimismKovan],
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
  const client = useMemo(() => hackMoneyClient[69], []);
  return (
    <ApolloProvider client={client}>
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
    </ApolloProvider>
  );
}

export default App;
