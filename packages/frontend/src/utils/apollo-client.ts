import { ApolloClient, HttpLink, InMemoryCache, split } from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";

const httpLinkOK = new HttpLink({
  uri: "https://api.thegraph.com/subgraphs/name/igorline/covered-strangle-t",
});

const wsLinkOK =
  typeof window !== "undefined"
    ? new WebSocketLink({
        uri: "wss://api.thegraph.com/subgraphs/name/igorline/covered-strangle-t",
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
