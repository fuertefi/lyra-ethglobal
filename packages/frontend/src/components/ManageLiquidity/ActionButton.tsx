import styled from "styled-components";
import { disabledGray, lightGray } from "../../theme";
import Button from "../Button";

const StyledButton = styled(Button)`
  font-size: 18px;
  font-weight: bold;
  background: radial-gradient(
    93.99% 86.5% at 51.43% 106.5%,
    #0699c7 0%,
    #06c799 49.41%,
    #06c799 100%
  );
  background-size: 100% 100px;
  background-position: 0;
  animation-duration: 0.3s;
  animation-name: buttonHoverOut;
  :hover {
    animation-name: buttonHoverIn;
    background-position: 0 -50px;
  }

  &:disabled {
    background: ${lightGray};
    pointer-events: none;
    color: ${disabledGray};
  }
`;

export const ActionButton = ({...props}) => {
  return <StyledButton {...props}></StyledButton>;
};