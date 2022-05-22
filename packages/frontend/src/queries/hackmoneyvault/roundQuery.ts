import { gql } from "@apollo/client";

export const ROUND_QUERY = gql`
  query rounds {
    rounds(orderBy: createdAt, orderDirection: desc, first: 1) {
      id
      lockedAmount
      createdAt
      roundInProgress
      expiry
      size
      premiumReceived
      positions
    }
  }
`;
export default ROUND_QUERY;
