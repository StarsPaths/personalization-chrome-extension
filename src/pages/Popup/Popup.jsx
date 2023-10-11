import React, { useEffect } from 'react';
import './Popup.css';
import { Form, Radio, message, Space, Button } from 'antd';

const Popup = () => {
  const [form] = Form.useForm();

  const onFinish = (values) => {
    const { environments, type } = values ?? {};

    chrome.storage.sync.set(
      {
        environments,
      },
      () => {
        message.success('Saved successfully !');
      }
    );
    chrome.runtime.sendMessage({ isSend: environments });
    chrome.storage?.local?.set({
      environments,
      type,
    });
  };
  useEffect(() => {
    chrome.storage?.local?.get(['environments', 'type'], (result) => {
      const { environments, type } = result ?? {};
      environments && form.setFieldValue('environments', environments);

      type && form.setFieldValue('type', type);
    });
  }, []);

  const currentType = Form.useWatch('type', form);

  return (
    <div className="App">
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 800 }}
        onFinish={onFinish}
        initialValues={{
          type: 'testing',
          environments: 'none',
        }}
      >
        <Form.Item label="" name="type">
          <Radio.Group>
            <Radio.Button value="pro">Pro Env</Radio.Button>
            <Radio.Button value="testing">Testing Env</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="" name="environments">
          <Radio.Group>
            <Space direction="vertical">
              <Radio value="none">None</Radio>
              {currentType === 'pro' ? (
                <>
                  <Radio value="staging">Staging</Radio>
                </>
              ) : (
                <>
                  <Radio value="kiwi">release-kiwi</Radio>
                  <Radio value="incy">release-incy</Radio>
                </>
              )}
            </Space>
          </Radio.Group>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            className="login-form-button"
          >
            Submit
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default Popup;
