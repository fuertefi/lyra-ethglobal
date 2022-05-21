import { useQuery } from "@apollo/client";
import ROUND_QUERY from "../queries/hackmoneyvault/roundQuery";
import { rounds } from "../queries/hackmoneyvault/__generated__/rounds";

const useRound = () => {
  const { data, loading } = useQuery<rounds>(ROUND_QUERY, {});

  return {
    data: data?.rounds[0],
    loading,
  };
};

export default useRound;
