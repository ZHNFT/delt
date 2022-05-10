import { ContractInterface, ethers } from "ethers"
import { NFTStorage } from "nft.storage"

import Delt from "../../defi/artifacts/contracts/delt.sol/Delt.json"
import { Wallet } from "./wallet.client"
export interface ContractRef {
  design: {
    id: number,
    created_at: number,
    created_by: string,
    owned_by: string,
    slug: string,
    published: boolean,
  },
  description?: string
  contract: ethers.Contract
  contractInterface: ContractInterface,
  contractAddress: string,
  deployContract: (wallet: Wallet) => void,
  store: (image: Blob, description: string, name: string) => void,
  updateMetadata: (mintResult: Boolean, slug: string) => void,
  getMintedStatus: (metadata: string, wallet: Wallet) => Promise<Boolean>,
  payToMint: (wallet: Wallet, design: Object, image: Blob) => Promise<any>,
  getURI: (tokenId: number) => Promise<string>,
  // safeMint: () => Promise<void>
}

export default defineNuxtPlugin(() => {
  // npx hardhat run scripts/deploy.ts --network ropsten
  // wallet: Wallet, design: Object, image: Blob
  const { CONTRACT_ADDRESS, NFT_STORAGE_KEY } = useRuntimeConfig()
  const contractRef = reactive<ContractRef>({
    contract: undefined,
    contractAddress: CONTRACT_ADDRESS,
    contractInterface: Delt.abi,

    // creates new contract object (doesnt work server side ??)
    deployContract: (wallet: Wallet) => {
      contractRef.contract = markRaw(new ethers.Contract(contractRef.contractAddress, contractRef.contractInterface, wallet.signer))
    },
    // description used on ipfs (maybe add created by username ??)

    // supabase design object
    design: undefined,

    // get minted status from passed URI, assumes contract is deployed
    getMintedStatus: async (metadataURI: string, wallet: Wallet) => {
      if (!metadataURI) { return false }
      if (!contractRef.contract) { contractRef.deployContract(wallet) }
      return await contractRef.contract.isContentOwned(metadataURI) as Boolean
    },

    // get URI from contract
    getURI: async (tokenId: number) => {
      return await contractRef.contract.tokenURI(tokenId)
    },

    // mints the design, brings together all the functions
    payToMint: async (wallet: Wallet, design: typeof contractRef.design, image: Blob) => {
      contractRef.deployContract(wallet)

      const metadataURI = ref<string>(undefined)
      try { metadataURI.value = await contractRef.getURI(design.id) } catch { }

      if (!metadataURI.value) {
        const connection = contractRef.contract.connect(wallet.signer)

        metadataURI.value = await contractRef.store(image, design.slug)

        const result = await contractRef.contract.payToMint(connection.address, metadataURI.value, {
          value: ethers.utils.parseEther("0.04")
        })

        const newItemId = await result.wait()
        console.log(newItemId)
        await contractRef.updateMetadata(true, design.slug)
      }

      return true
    },

    // stores the image on the ipfs with tokenId/slug and fixed description
    // gives metadataURI that is used in the contract (may or maynot be correct)
    store: async (image: Blob, name: string, description: string = "DELT NFT Design") => {
      const api = new NFTStorage({ token: NFT_STORAGE_KEY })
      const metadata = await api.store({
        description,
        image,
        name
      })
      return metadata.url.replace(/^ipfs:\/\//, "")
      // const metadataURI = ref<string>(`${NFT_STORAGE_KEY}/${tokenID}.json`)
      // const imageURI = ref<string>(`ipfs://${NFT_STORAGE_KEY}/${tokenId}.png`)
    },

    // updates metadataURI in supabase (should we use all metadata from store() ??
    updateMetadata: async (mintResult: Boolean, slug: string) => {
      await useSupabaseClient()
        .from("designs")
        .update({ published: mintResult })
        .eq("slug", slug)
    }
  })
  return {
    provide: {
      contractRef
    }
  }
})
