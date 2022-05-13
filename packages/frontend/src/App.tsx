import React from "react";
import { createGlobalStyle, ThemeProvider } from "styled-components";
import { Layout } from "./components/Layout";

const theme = {};

const GlobalStyle = createGlobalStyle`
  body {
     font-family: serif;
     background: #000;
     color: #99A0AB;
     font-family: 'Satoshi', sans-serif;
  }
`;

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Layout>test</Layout>
    </ThemeProvider>
  );
}

export default App;
