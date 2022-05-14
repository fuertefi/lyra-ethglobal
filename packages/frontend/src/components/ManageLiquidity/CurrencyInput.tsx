import styled from "styled-components";
import { useAccount, useBalance } from "wagmi";
import { useState } from "react";
import { ErrorIcon as ErrorIconSvg } from "../Icons";
import { USDC_ADDRESS } from "../../constants";

interface InputProps extends React.ComponentPropsWithoutRef<"div"> {
  error: boolean;
  filled?: boolean;
}

const Input = styled.input`
  outline: none;
  border: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  width: 100%;
  background: none;
  font-family: "Clash Display";
  font-weight: 600;
  font-size: 24px;

  color: ${({ theme }) => theme.position.input.color};

  ::placeholder {
    color: ${({ theme }) => theme.position.input.placeholder.color};
    opacity: 1;
  }
`;

const SupContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  .max {
    cursor: pointer;
  }
`;

const Sup = styled.div`
  font-size: 12px;
  margin-bottom: 4px;
`;

const InputContainer = styled.div<InputProps>`
  border: 1px solid
    ${({ theme, error }) =>
      error
        ? theme.position.input.border.error
        : theme.position.input.border.normal};
  color: ${({ filled }) => (filled ? "#FFF" : "inherit")};
  border-radius: 10px;
  display: flex;
  flex-direction: row;
  font-weight: 600;
  font-size: 24px;
  padding: 0.5rem 1rem;
  gap: 1rem;
  font-family: "Clash Display";
  margin-bottom: 2px;
`;

const ErrorContainer = styled.div`
  color: ${({ theme }) => theme.position.input.error};
  font-size: 12px;
  position: absolute;
`;

const ErrorIcon = styled.span`
  position: relative;
  top: 2px;
  margin-right: 9px;

  svg {
    .fill {
      fill: ${({ theme }) => theme.icons.error};
    }
  }
`;

type CurrencyInputProps = {
  currency?: string;
};

export const CurrencyInput = ({ currency = "ETH" }: CurrencyInputProps) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const account = useAccount();
  const { data: balanceData } = useBalance({
    addressOrName: account.data?.address,
    token: USDC_ADDRESS,
    formatUnits: 6,
  });

  const balanceAmount = parseFloat(balanceData?.formatted ?? "0");

  const validateAmount = (amount: string) => {
    console.log(parseFloat(amount) > balanceAmount);
    if (parseFloat(amount) > balanceAmount) {
      setError("Amount exceeds balance");
    } else {
      setError(undefined);
    }

    setValue(amount);
  };

  return (
    <div>
      <SupContainer>
        <Sup
          className={"max"}
          onClick={() => setValue(balanceData?.formatted ?? "0")}
        >
          Use max: {balanceAmount} {currency}
        </Sup>
      </SupContainer>
      <InputContainer error={!!error} filled={!!value}>
        <Input
          type={"text"}
          inputMode={"decimal"}
          pattern="^[0-9]*[.,]?[0-9]*$"
          placeholder={"0.0"}
          spellCheck={false}
          value={value}
          onChange={({ target }) => validateAmount(target.value)}
        />
        <div>{currency}</div>
      </InputContainer>
      {error && (
        <ErrorContainer>
          <ErrorIcon>
            <ErrorIconSvg />
          </ErrorIcon>
          {error}
        </ErrorContainer>
      )}
    </div>
  );
};

export default CurrencyInput;