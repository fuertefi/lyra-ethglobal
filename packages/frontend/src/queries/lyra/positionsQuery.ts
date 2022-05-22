import { gql } from "@apollo/client";

export const POSITIONS_QUERY = gql`
  query Positions($positions: [Int]) {
    positions(where: { positionId_in: $positions }) {
      id
      positionId
      size
      strike {
        strikePrice
      }
    }
  }
`;
export default POSITIONS_QUERY;
