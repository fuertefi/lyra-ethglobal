import styled from "styled-components";

type TitleProps = {
  children: any;
  icon: string;
};

const Header = styled.header`
  font-family: "Clash Display";
  font-style: normal;
  font-weight: 600;
  font-size: 40px;
  line-height: 40px;

  /* or 75% */
  letter-spacing: -0.01em;

  color: #000000;

  display: flex;
  align-items: center;
`;

const Container = styled.div`
  display: flex;
  justify-content: space-between;
`;

const Title = ({ children, icon }: TitleProps) => (
  <Container>
    <Header>{children}</Header>
    <img src={icon} alt="strategy" width="197" />
  </Container>
);

export default Title;
