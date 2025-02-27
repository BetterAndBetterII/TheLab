import { Typography, Timeline } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const About = () => {
  return (
    <div>
      <Typography style={{ marginBottom: '48px' }}>
        <Title>关于 TheLab</Title>
        <Paragraph>
          TheLab 是一个致力于提升实验室管理效率的现代化系统。我们的目标是通过技术创新，
          为科研工作者提供更好的工作环境和工具支持。
        </Paragraph>
      </Typography>

      <Title level={3}>发展历程</Title>
      <Timeline
        mode="left"
        items={[
          {
            label: '2024年2月',
            children: '项目启动',
            dot: <ClockCircleOutlined style={{ fontSize: '16px' }} />,
          },
          {
            label: '2024年3月',
            children: '完成基础功能开发',
          },
          {
            label: '2024年4月',
            children: 'AI功能集成',
          },
          {
            label: '2024年5月',
            children: '正式发布1.0版本',
          },
        ]}
      />
    </div>
  );
};

export default About;
