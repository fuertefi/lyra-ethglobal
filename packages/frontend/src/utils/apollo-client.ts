import { ApolloClient, HttpLink, InMemoryCache, split } from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";

const httpLyraLinkOK = new HttpLink({
  uri: "https://api.thegraph.com/subgraphs/name/lyra-finance/kovan",
});

const wsLyraLinkOK =
  typeof window !== "undefined"
    ? new WebSocketLink({
        uri: "wss://api.thegraph.com/subgraphs/name/lyra-finance/kovan",
        options: {
          reconnect: true,
        },
      })
    : null;

const httpLinkOK = new HttpLink({
  uri: "https://api.thegraph.com/subgraphs/name/igorline/covered-strangle",
});

const wsLinkOK =
  typeof window !== "undefined"
    ? new WebSocketLink({
        uri: "wss://api.thegraph.com/subgraphs/name/igorline/covered-strangle",
        options: {
          reconnect: true,
        },
      })
    : null;

const splitLink = (wsLink: any, httpLink: any) => {
  return split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      );
    },
    wsLink,
    httpLink
  );
};

const optimismKovan = new ApolloClient({
  link:
    typeof window !== "undefined" ? splitLink(wsLinkOK, httpLinkOK) : undefined,
  cache: new InMemoryCache(),
});

export const hackMoneyClient = {
  69: optimismKovan,
};

const lyraOptimismKovan = new ApolloClient({
  link:
    typeof window !== "undefined"
      ? splitLink(wsLyraLinkOK, httpLyraLinkOK)
      : undefined,
  cache: new InMemoryCache(),
});

export const lyraClient = {
  69: lyraOptimismKovan,
};
