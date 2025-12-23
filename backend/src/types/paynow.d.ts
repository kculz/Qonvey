// backend/src/@types/paynow.d.ts

declare module 'paynow' {
  /**
   * Represents the Paynow API client instance.
   */
  export class Paynow {
    constructor(
      integrationId: string,
      integrationKey: string,
      returnUrl: string,
      resultUrl: string
    );

    /**
     * Creates a new Payment object.
     * @param reference The unique identifier for the payment (e.g., invoice ID).
     * @param authEmail The user's email or phone number used for authentication.
     */
    createPayment(reference: string, authEmail: string): Payment;

    /**
     * Initiates a mobile (EcoCash/OneMoney) payment request.
     */
    sendMobile(
      payment: Payment,
      phoneNumber: string,
      method: 'ecocash' | 'onemoney'
    ): Promise<PaynowResponse>;

    /**
     * Initiates a card or general web payment request.
     */
    send(payment: Payment): Promise<PaynowResponse>;

    /**
     * Polls the status of a payment using the poll URL provided in the initial response.
     */
    pollTransaction(pollUrl: string): Promise<PaymentStatusResponse>;
  }

  /**
   * Represents a single payment transaction details.
   */
  export class Payment {
    constructor(reference: string, authEmail: string);
    /**
     * Adds an item and amount to the payment request.
     * @param item The description of the item.
     * @param amount The cost of the item.
     */
    add(item: string, amount: number): void;
  }

  /**
   * Represents the response structure from sendMobile or send methods.
   */
  export interface PaynowResponse {
    success: boolean;
    error: string | null;
    reference: string;
    pollUrl: string; // URL used to check payment status
    redirectUrl?: string; // URL to redirect user for card payments
    status: string;
    instructions: string;
  }

  /**
   * Represents the response structure from pollTransaction method.
   */
  export interface PaymentStatusResponse {
    paid: boolean;
    amount: number;
    reference: string;
    status: string; // e.g., 'Paid', 'Pending', 'Cancelled'
    error: string | null;
    pollUrl: string;
  }
}
