import styled from "styled-components";

const Button = styled.button`
  padding: 9.5px 27px;
  height: 50px;
  background: ${(props) => props.theme.button.bg};
  color: ${(props) => props.theme.button.color};
  border-radius: 30px;
  border: none;
  cursor: pointer;
`;

export default Button;
