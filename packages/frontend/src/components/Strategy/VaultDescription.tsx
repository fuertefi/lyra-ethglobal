import styled from "styled-components";

type VaultDescriptionProps = {
  children: React.ReactNode;
};

const Header = styled.header`
  font-weight: 700;
  font-family: "Satoshi";
  margin-bottom: 8px;
  margin-top: 50px;
`;

const VaultDescription = ({ children }: VaultDescriptionProps) => (
  <div>
    <Header>Strategy description</Header>
    {children}
  </div>
);

export default VaultDescription;
