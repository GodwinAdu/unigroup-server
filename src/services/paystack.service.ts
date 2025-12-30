const fetch = require('node-fetch');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

export interface PaymentInitialization {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaymentVerification {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: any;
    fees: number;
    customer: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    };
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
    };
  };
}

export class PaystackService {
  static async initializePayment(
    email: string,
    amount: number, // in pesewas for GHS, kobo for NGN
    reference: string,
    currency: string = 'GHS',
    metadata?: any,
    callback_url?: string
  ): Promise<PaymentInitialization> {
    try {
      const payload = {
        email,
        amount,
        reference,
        currency,
        metadata,
        callback_url: callback_url || `${process.env.FRONTEND_URL}/payment/callback`,
      };

      console.log('Paystack payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Paystack response:', JSON.stringify(data, null, 2));

      if (!data.status) {
        throw new Error(data.message || 'Payment initialization failed');
      }

      return data.data;
    } catch (error: any) {
      throw new Error(`Paystack initialization error: ${error.message}`);
    }
  }

  static async verifyPayment(reference: string): Promise<PaymentVerification> {
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      throw new Error(`Paystack verification error: ${error.message}`);
    }
  }

  static async createTransferRecipient(
    name: string,
    account_number: string,
    bank_code: string,
    currency: string = 'NGN'
  ) {
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'nuban',
          name,
          account_number,
          bank_code,
          currency,
        }),
      });

      const data = await response.json();

      if (!data.status) {
        throw new Error(data.message || 'Transfer recipient creation failed');
      }

      return data.data;
    } catch (error: any) {
      throw new Error(`Transfer recipient error: ${error.message}`);
    }
  }

  static async initiateTransfer(
    amount: number, // in kobo
    recipient: string,
    reason?: string
  ) {
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount,
          recipient,
          reason: reason || 'Association settlement',
        }),
      });

      const data = await response.json();

      if (!data.status) {
        throw new Error(data.message || 'Transfer initiation failed');
      }

      return data.data;
    } catch (error: any) {
      throw new Error(`Transfer error: ${error.message}`);
    }
  }

  static async getBanks() {
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/bank`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (!data.status) {
        throw new Error(data.message || 'Failed to fetch banks');
      }

      return data.data;
    } catch (error: any) {
      throw new Error(`Banks fetch error: ${error.message}`);
    }
  }

  static async verifyAccountNumber(account_number: string, bank_code: string) {
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!data.status) {
        throw new Error(data.message || 'Account verification failed');
      }

      return data.data;
    } catch (error: any) {
      throw new Error(`Account verification error: ${error.message}`);
    }
  }
}