import styled from "styled-components";
import {disabledGray, lightGray} from "../theme";

const Button = styled.button`
  padding: 9.5px 27px;
  height: 50px;
  background: ${(props) => props.theme.button.bg};
  color: ${(props) => props.theme.button.color};
  border-radius: 30px;
  border: none;
  cursor: pointer;

  &:disabled {
    background: ${lightGray};
    pointer-events: none;
    color: ${disabledGray};
  }
`;

export default Button;
