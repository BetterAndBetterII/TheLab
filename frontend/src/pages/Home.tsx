import { Typography, Card, Row, Col } from 'antd';
import { ExperimentOutlined, RobotOutlined, ApiOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const Home = () => {
  const features = [
    {
      title: '实验室管理',
      icon: <ExperimentOutlined style={{ fontSize: '32px' }} />,
      description: '高效的实验室资源管理系统，支持设备预约、使用记录等功能。',
    },
    {
      title: 'AI 辅助',
      icon: <RobotOutlined style={{ fontSize: '32px' }} />,
      description: '集成先进的 AI 技术，提供智能分析和决策支持。',
    },
    {
      title: 'API 集成',
      icon: <ApiOutlined style={{ fontSize: '32px' }} />,
      description: '提供丰富的 API 接口，支持与其他系统的无缝集成。',
    },
  ];

  return (
    <div>
      <Typography style={{ textAlign: 'center', marginBottom: '48px' }}>
        <Title>欢迎使用 TheLab</Title>
        <Paragraph>
          TheLab 是一个现代化的实验室管理系统，集成了多种先进技术，
          <br />
          为科研工作提供全方位的支持。
        </Paragraph>
      </Typography>

      <Row gutter={[24, 24]}>
        {features.map((feature, index) => (
          <Col key={index} xs={24} sm={12} md={8}>
            <Card hoverable style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '16px' }}>{feature.icon}</div>
              <Title level={4}>{feature.title}</Title>
              <Paragraph>{feature.description}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default Home;
