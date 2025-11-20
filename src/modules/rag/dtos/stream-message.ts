export class StreamMessage{
  type: string;
  [key: string]: any;

  constructor(type: string, data: any){
    this.type = type;
    Object.assign(this, data);
  }
    
}