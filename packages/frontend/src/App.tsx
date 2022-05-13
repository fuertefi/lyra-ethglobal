import React from "react";
import { createGlobalStyle, ThemeProvider } from "styled-components";
import { Layout } from "./components/Layout";
import { Main } from "./pages/Main";

const theme = {
  position: {
    bg: "#2C2E32",
    inactiveTabBg: "#1F2124",
    tabs: {
      inactive: {
        bg: "#1F2124",
        color: "#42454A",
      },
    },
  },
  button: {
    bg: "#06C799",
    color: "#000",
  },
};

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
  
`;

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Layout>
        <Main />
      </Layout>
    </ThemeProvider>
  );
}

export default App;
