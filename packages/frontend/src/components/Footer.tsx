import styled from "styled-components";

const StyledFooter = styled.div`
  display: flex;
  max-width: 1272px;
  margin: 0 auto 53px;
  justify-content: space-between;
`;

const WhiteText = styled.span`
  color: white;
`;
const GreenText = styled.span`
  color: #06c799;
`;

export const Footer = () => {
  return (
    <StyledFooter>
      <span>
        <GreenText>Covered Strangle</GreenText> Strategy on Lyra. HackMoney 2022
      </span>
      <WhiteText>The Future of Finance</WhiteText>
    </StyledFooter>
  );
};
