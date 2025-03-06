import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import List, Optional, Union


class EmailService:
    def __init__(
        self,
        smtp_host: str = None,
        smtp_port: int = None,
        smtp_user: str = None,
        smtp_password: str = None,
        use_tls: bool = True,
        default_sender: str = None,
        default_sender_name: str = None,
    ):
        """初始化邮件服务 :param smtp_host: SMTP服务器地址 :param smtp_port: SMTP服务器端口 :param smtp_user: SMTP用户名 :param
        smtp_password: SMTP密码 :param use_tls: 是否使用TLS加密 :param default_sender: 默认发件人邮箱 :param default_sender_name:
        默认发件人名称."""
        self.smtp_host = smtp_host or os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = smtp_port or int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = smtp_user or os.getenv("SMTP_USER")
        self.smtp_password = smtp_password or os.getenv("SMTP_PASSWORD")
        self.use_tls = use_tls
        self.default_sender = default_sender or os.getenv("SMTP_DEFAULT_SENDER")
        self.default_sender_name = default_sender_name or os.getenv("SMTP_DEFAULT_SENDER_NAME", "System")

    def _create_message(
        self,
        subject: str,
        body: str,
        to_addresses: Union[str, List[str]],
        from_address: Optional[str] = None,
        from_name: Optional[str] = None,
        is_html: bool = False,
    ) -> MIMEMultipart:
        """创建邮件消息 :param subject: 邮件主题 :param body: 邮件内容 :param to_addresses: 收件人地址（单个或列表） :param from_address:
        发件人地址（可选） :param from_name: 发件人名称（可选） :param is_html: 是否为HTML内容 :return: 邮件消息对象."""
        msg = MIMEMultipart()
        msg["Subject"] = subject

        # 处理收件人地址
        if isinstance(to_addresses, str):
            to_addresses = [to_addresses]
        msg["To"] = ", ".join(to_addresses)

        # 处理发件人信息
        sender_email = from_address or self.default_sender
        sender_name = from_name or self.default_sender_name
        msg["From"] = formataddr((sender_name, sender_email))

        # 设置邮件内容
        content_type = "html" if is_html else "plain"
        msg.attach(MIMEText(body, content_type, "utf-8"))

        return msg

    def send_email(
        self,
        subject: str,
        body: str,
        to_addresses: Union[str, List[str]],
        from_address: Optional[str] = None,
        from_name: Optional[str] = None,
        is_html: bool = False,
    ) -> bool:
        """发送邮件 :param subject: 邮件主题 :param body: 邮件内容 :param to_addresses: 收件人地址（单个或列表） :param from_address: 发件人地址（可选）
        :param from_name: 发件人名称（可选） :param is_html: 是否为HTML内容 :return: 是否发送成功."""
        try:
            # 创建邮件消息
            msg = self._create_message(
                subject,
                body,
                to_addresses,
                from_address,
                from_name,
                is_html,
            )

            print("Start send email")
            # 连接SMTP服务器
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                print("Start login")
                # 登录认证
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                print("Login Success")
                # 发送邮件
                sender = from_address or self.default_sender
                if isinstance(to_addresses, str):
                    to_addresses = [to_addresses]

                server.sendmail(sender, to_addresses, msg.as_string())
                print("Send Success")
                return True

        except Exception as e:
            print(f"发送邮件失败: {str(e)}")
            return False

    def send_verification_email(
        self,
        to_address: str,
        verification_code: str,
        username: str = "用户",
    ) -> bool:
        """发送验证码邮件 :param to_address: 收件人地址 :param verification_code: 验证码 :param username: 用户名 :return: 是否发送成功."""
        subject = "验证码 - 请验证您的邮箱"
        body = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>您好，{username}！</h2>
    <p>您的验证码是：</p>
    <div style="background-color: #f5f5f5;
        padding: 15px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0;">
        {verification_code}
    </div>
    <p>此验证码将在10分钟内有效。</p>
    <p>如果这不是您的操作，请忽略此邮件。</p>
    <hr style="margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
</div>
        """
        return self.send_email(
            subject=subject,
            body=body,
            to_addresses=to_address,
            is_html=True,
        )

    def send_password_reset_email(
        self,
        to_address: str,
        reset_link: str,
        username: str = "用户",
    ) -> bool:
        """发送密码重置邮件 :param to_address: 收件人地址 :param reset_link: 重置链接 :param username: 用户名 :return: 是否发送成功."""
        subject = "密码重置 - 重置您的密码"
        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>您好，{username}！</h2>
            <p>我们收到了重置您密码的请求。如果这是您的操作，请点击下面的链接重置密码：</p>
            <div style="margin: 20px 0;">
                <a href="{reset_link}" style="background-color: #4CAF50;
                color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    重置密码
                </a>
            </div>
            <p>此链接将在24小时内有效。</p>
            <p>如果这不是您的操作，请忽略此邮件并确保您的账户安全。</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
        </div>
        """
        return self.send_email(
            subject=subject,
            body=body,
            to_addresses=to_address,
            is_html=True,
        )
