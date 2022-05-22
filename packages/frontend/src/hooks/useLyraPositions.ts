import { useQuery } from "@apollo/client";
import POSITIONS_QUERY from "../queries/lyra/positionsQuery";
import { Positions } from "../queries/lyra/__generated__/Positions";
import { lyraClient } from "../utils/apollo-client";

const usePositions = (positions: any[]) => {
  const { data, loading } = useQuery<Positions>(POSITIONS_QUERY, {
    client: lyraClient[69],
    variables: {
      positions: positions.map((i) => parseInt(i)),
    },
  });

  return {
    data: data?.positions,
    loading,
  };
};

export default usePositions;
